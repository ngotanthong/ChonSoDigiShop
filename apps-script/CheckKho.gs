// ==========================================
// CHECK TỒN KHO SIM — VNPT DIGISHOP (Google Apps Script)
// ==========================================
// Dùng để kiểm tra 1 số / nhiều số / cả danh sách trong Sheet còn hàng hay đã bán.
//
// VÌ SAO BẢN CŨ HAY BÁO SAI (xem chi tiết trong HUONG_DAN_CHECK_KHO.md):
//   1. Gửi NGUYÊN SỐ (10 số) vào ?search=  -> API trả 0 dòng -> bị coi là "đã bán".
//      API chỉ nhận ĐÚNG 7 SỐ CUỐI. prefix = "84" + 2 số đầu sau số 0.
//   2. Chỉ kiểm tra commit=0 -> số bán kèm cam kết (100k/200k/600k) không bao giờ
//      xuất hiện trong kết quả -> bị coi là "đã bán" oan.
//      => Phải thử lần lượt các mức commit trong CK_COMMIT_VALUES.
//   3. Dùng data.length để kết luận thay vì so khớp CHÍNH XÁC từng số.
//      search=7 số cuối trả về TẤT CẢ số có cùng đuôi -> luôn có dòng, nhưng có thể
//      không có đúng số mình cần.
//   4. API lỗi (errorCode != 0, HTTP 4xx/5xx, timeout) cũng bị coi là "đã bán".
//      => Phải trả "không kiểm tra được" (conHang = null), KHÔNG phải đã bán.
//
// CÁCH DÙNG NHANH
//   - Deploy Web App (xem HUONG_DAN_CHECK_KHO.md) rồi gọi:
//     <URL>?action=ping
//     <URL>?action=check&phone=0912345678
//     <URL>?action=check&phones=0912345678,0987654321
//     <URL>?action=check_all          (kiểm tra cả tab CHECKKHO, ghi kết quả lại)
//   - Trong Sheet: menu "📦 Check kho SIM".
// ==========================================

var CK_API_BASE = "https://digishop.vnpt.vn/apiprod/v2/simso/num_search";

// Các mức cam kết API thực sự trả về (đã kiểm tra thực tế 10/2026):
//   0 = không cam kết, 100000 / 200000 / 600000 = cam kết theo tháng.
// Số nằm ở mức nào chỉ xuất hiện khi query đúng mức đó -> phải thử hết.
var CK_COMMIT_VALUES = [0, 100000, 200000, 600000];

var CK_SHEET_NAME = "CHECKKHO";
var CK_CACHE_SECONDS = 300;      // 5 phút: đủ nhanh, tránh gọi API trùng
var CK_SLEEP_MS = 120;           // nghỉ giữa các số khi check hàng loạt
var CK_MAX_PER_REQUEST = 20;     // số lượng số tối đa cho 1 lần gọi doGet (mỗi số 1-4 request)
var CK_MAX_ROWS_PER_RUN = 80;    // số dòng tối đa mỗi lần chạy menu (tránh timeout 6 phút)

// ==========================================
// CHUẨN HOÁ SỐ ĐIỆN THOẠI
// ==========================================
function ckNormalizePhone_(raw) {
  var s = String(raw == null ? "" : raw).replace(/[^0-9]/g, "");
  if (!s) return "";
  // 0084xxxxxxxxx -> 84xxxxxxxxx -> 0xxxxxxxxx
  if (s.indexOf("0084") === 0) s = s.slice(2);
  if (s.indexOf("84") === 0 && s.length >= 11) s = "0" + s.slice(2);
  // 9 số (người dùng gõ thiếu số 0) -> thêm 0
  if (s.length === 9 && s.charAt(0) !== "0") s = "0" + s;
  return s;
}

function ckIsValidPhone_(phone) {
  return /^0\d{9}$/.test(String(phone || ""));
}

// Tách số thành tham số API.
//   0912345678 -> prefix "8491", search "2345678" (7 số cuối: p.slice(3))
function ckBuildQuery_(phone) {
  var p = ckNormalizePhone_(phone);
  if (!ckIsValidPhone_(p)) return null;
  return {
    phone: p,
    prefix: "84" + p.slice(1, 3),
    search: p.slice(3)
  };
}

function ckBuildUrl_(query, commit) {
  return CK_API_BASE +
    "?search=" + encodeURIComponent(query.search) +
    "&prefix=" + encodeURIComponent(query.prefix) +
    "&commit=" + encodeURIComponent(String(commit == null ? 0 : commit));
}

// ==========================================
// ĐỌC KẾT QUẢ API
// ==========================================
// So khớp CHÍNH XÁC, không dựa vào data.length.
function ckFindExact_(rows, phone) {
  if (!rows || !rows.length) return null;
  for (var i = 0; i < rows.length; i++) {
    if (ckNormalizePhone_(rows[i] && rows[i].so_tb) === phone) return rows[i];
  }
  return null;
}

function ckRowToInfo_(row) {
  if (!row) return {};
  return {
    monthly: Number(row.monthly) || 0,
    commitment: row.commitment != null ? String(row.commitment) : "",
    price: Number(row.price) || 0,
    stock: row.stock != null ? String(row.stock) : "",
    status: row.status != null ? String(row.status) : "",
    kieuso: String(row.kieuso_name || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim()
  };
}

// Gọi API cho 1 mức commit. Trả { ok, rows } hoặc { ok:false, error }.
function ckFetchCommit_(query, commit) {
  var url = ckBuildUrl_(query, commit);
  var res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  } catch (e) {
    return { ok: false, error: "Không gọi được API: " + (e && e.message ? e.message : e) };
  }

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) return { ok: false, error: "HTTP " + code };

  var json;
  try {
    json = JSON.parse(res.getContentText());
  } catch (e2) {
    return { ok: false, error: "API trả về không phải JSON" };
  }

  // VNPT trả errorCode = -1 khi KHÔNG có kết quả (không phải lỗi server).
  // => coi như "0 dòng", KHÔNG coi là lỗi (nếu coi là lỗi thì số đã bán
  //    sẽ mãi ở trạng thái "không kiểm tra được").
  if (json.errorCode === -1) return { ok: true, rows: [] };
  if (json.errorCode !== 0) {
    return { ok: false, error: "API errorCode=" + json.errorCode };
  }
  return { ok: true, rows: json.data || [] };
}

// Kiểm tra API còn sống (dùng khi không tìm thấy số: phân biệt "đã bán" với
// "API đang lỗi"). Chỉ gọi 1 lần cho mỗi lần chạy script.
var CK_ALIVE_CACHE = null;
function ckApiAlive_() {
  if (CK_ALIVE_CACHE !== null) return CK_ALIVE_CACHE;
  var r = ckFetchCommit_({ prefix: "8491", search: "*68*" }, 0);
  CK_ALIVE_CACHE = !!(r.ok && r.rows && r.rows.length);
  return CK_ALIVE_CACHE;
}

// ==========================================
// CACHE
// ==========================================
function ckGetCache_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

// Cache có "version": khi cần xoá toàn bộ, chỉ cần tăng version.
var CK_CACHE_VERSION_KEY = "ck_cache_version";

function ckCacheVersion_() {
  var cache = ckGetCache_();
  if (!cache) return "1";
  try { return String(cache.get(CK_CACHE_VERSION_KEY) || "1"); } catch (e) { return "1"; }
}

function ckCacheKey_(phone) {
  return "ck" + ckCacheVersion_() + "_" + phone;
}

function ckClearCache_() {
  var cache = ckGetCache_();
  if (!cache) return false;
  try {
    var v = Number(ckCacheVersion_()) + 1;
    cache.put(CK_CACHE_VERSION_KEY, String(v), 21600);
    return true;
  } catch (e) {
    return false;
  }
}

function ckCacheGet_(phone) {
  var cache = ckGetCache_();
  if (!cache) return null;
  try {
    var raw = cache.get(ckCacheKey_(phone));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function ckCachePut_(phone, result) {
  var cache = ckGetCache_();
  if (!cache) return;
  try { cache.put(ckCacheKey_(phone), JSON.stringify(result), CK_CACHE_SECONDS); } catch (e) {}
}

// ==========================================
// HÀM CHÍNH: KIỂM TRA 1 SỐ
// ==========================================
// Trả về:
//   { so, conHang: true,  trangThai: "Còn hàng", monthly, commitment, price, stock, kieuso, checkedAt }
//   { so, conHang: false, trangThai: "Đã bán / không còn" }
//   { so, conHang: null,  trangThai: "Không kiểm tra được", loi }
//
// opts: { boQuaCache: true }  -> không đọc/ghi cache
//       { commits: [0, 100000] } -> chỉ thử các mức cam kết này
function checkSoTrongKho_(phone, opts) {
  opts = opts || {};
  var query = ckBuildQuery_(phone);
  if (!query) {
    return {
      so: String(phone == null ? "" : phone),
      conHang: null,
      trangThai: "Số không hợp lệ",
      loi: "Số phải có 10 chữ số dạng 0xxxxxxxxx"
    };
  }

  if (!opts.boQuaCache) {
    var cached = ckCacheGet_(query.phone);
    if (cached) return cached;
  }

  var commits = (opts.commits && opts.commits.length) ? opts.commits : CK_COMMIT_VALUES;
  var found = null;
  var foundCommit = null;
  var soLanThanhCong = 0;
  var loiArr = [];

  for (var i = 0; i < commits.length; i++) {
    var r = ckFetchCommit_(query, commits[i]);
    if (!r.ok) {
      loiArr.push(String(commits[i]) + ": " + r.error);
      continue;
    }
    soLanThanhCong++;
    var hit = ckFindExact_(r.rows, query.phone);
    if (hit) {
      found = hit;
      foundCommit = commits[i];
      break;
    }
  }

  var out;
  if (found) {
    var info = ckRowToInfo_(found);
    out = {
      so: query.phone,
      conHang: true,
      trangThai: "Còn hàng",
      commitDaTimThay: foundCommit,
      monthly: info.monthly,
      commitment: info.commitment,
      price: info.price,
      stock: info.stock,
      status: info.status,
      kieuso: info.kieuso
    };
  } else if (soLanThanhCong === 0) {
    // Không query được mức nào -> KHÔNG được kết luận đã bán
    out = {
      so: query.phone,
      conHang: null,
      trangThai: "Không kiểm tra được",
      loi: loiArr.join("; ")
    };
  } else if (!ckApiAlive_()) {
    // Không thấy số + API không trả được dữ liệu kiểm chứng -> chưa kết luận
    out = {
      so: query.phone,
      conHang: null,
      trangThai: "Không kiểm tra được",
      loi: "API không phản hồi dữ liệu kiểm chứng"
    };
  } else {
    out = {
      so: query.phone,
      conHang: false,
      trangThai: "Đã bán / không còn",
      soMucDaKiemTra: soLanThanhCong
    };
  }

  out.checkedAt = new Date().toISOString();
  if (!opts.boQuaCache) ckCachePut_(query.phone, out);
  return out;
}

// ==========================================
// NHIỀU SỐ
// ==========================================
function checkNhieuSo_(phones, opts) {
  var results = [];
  for (var i = 0; i < phones.length; i++) {
    if (i > 0 && CK_SLEEP_MS > 0) {
      try { Utilities.sleep(CK_SLEEP_MS); } catch (e) {}
    }
    results.push(checkSoTrongKho_(phones[i], opts));
  }
  return results;
}

// ==========================================
// ĐỌC THAM SỐ TỪ URL
// ==========================================
function ckParsePhones_(p) {
  p = p || {};
  var out = [];
  var seen = {};
  function add(v) {
    var s = ckNormalizePhone_(v);
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  }

  if (p.phones) {
    String(p.phones).split(/[,;\s|]+/).forEach(function (x) { if (x) add(x); });
  }
  if (p.phone) add(p.phone);

  if (!out.length && p.json) {
    try {
      var arr = JSON.parse(p.json);
      if (Object.prototype.toString.call(arr) === "[object Array]") {
        arr.forEach(function (x) { add(x && x.so ? x.so : x); });
      }
    } catch (e) {}
  }
  return out;
}

function ckParseCommits_(raw) {
  if (!raw) return null;
  var arr = String(raw).split(/[,;\s|]+/).map(function (x) { return Number(x); })
    .filter(function (n) { return !isNaN(n) && n >= 0; });
  return arr.length ? arr : null;
}

// ==========================================
// SHEET
// ==========================================
function ckGetSS_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Project chưa gắn với file Sheet nào.");
  return ss;
}

function ckGetSheet_() {
  var ss = ckGetSS_();
  var sheet = ss.getSheetByName(CK_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CK_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Số", "Còn hàng", "Trạng thái", "Giá/tháng", "Cam kết", "Kho", "Kiểu số", "Kiểm tra lúc"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Kiểm tra toàn bộ số ở cột A của tab CHECKKHO, ghi kết quả vào các cột B..H.
// Trả về thống kê: { tong, conHang, daBan, khongRo, conLai }
function ckCheckSheet_(limit) {
  var sheet = ckGetSheet_();
  var maxRows = limit || CK_MAX_ROWS_PER_RUN;
  var values = sheet.getDataRange().getValues();
  var summary = { tong: 0, conHang: 0, daBan: 0, khongRo: 0, conLai: 0 };

  var rowsToCheck = 0;
  for (var i = 1; i < values.length; i++) {
    if (ckNormalizePhone_(values[i][0])) rowsToCheck++;
  }

  var done = 0;
  for (var r = 1; r < values.length; r++) {
    var phone = ckNormalizePhone_(values[r][0]);
    if (!phone) continue;
    if (done >= maxRows) {
      summary.conLai = rowsToCheck - done;
      break;
    }
    if (done > 0 && CK_SLEEP_MS > 0) {
      try { Utilities.sleep(CK_SLEEP_MS); } catch (e) {}
    }
    done++;
    summary.tong++;

    var kq = checkSoTrongKho_(phone);
    if (kq.conHang === true) summary.conHang++;
    else if (kq.conHang === false) summary.daBan++;
    else summary.khongRo++;

    sheet.getRange(r + 1, 2, 1, 7).setValues([[
      kq.conHang === true ? "Còn" : (kq.conHang === false ? "Đã bán" : "?"),
      kq.trangThai || "",
      kq.monthly != null ? kq.monthly : "",
      kq.commitment != null ? kq.commitment : "",
      kq.stock != null ? kq.stock : "",
      kq.kieuso != null ? kq.kieuso : "",
      new Date()
    ]]);
  }

  SpreadsheetApp.flush();
  return summary;
}

// ==========================================
// MENU TRONG SHEET
// ==========================================
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("📦 Check kho SIM")
      .addItem("Kiểm tra 1 số…", "ckMenuCheckOne")
      .addItem("Kiểm tra cả tab " + CK_SHEET_NAME, "ckMenuCheckSheet")
      .addSeparator()
      .addItem("Tạo tab " + CK_SHEET_NAME, "ckMenuCreateSheet")
      .addItem("Xoá cache kết quả", "ckMenuClearCache")
      .addToUi();
  } catch (e) {}
}

function ckMenuCheckOne() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Kiểm tra tồn kho", "Nhập số cần kiểm tra (VD 0912345678):", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var kq = checkSoTrongKho_(res.getResponseText(), { boQuaCache: true });
  var msg = "Số: " + kq.so + "\nKết quả: " + kq.trangThai;
  if (kq.conHang === true) {
    msg += "\nGiá/tháng: " + (kq.monthly || 0) + "đ" +
      "\nCam kết: " + (kq.commitment || "-") +
      "\nKho: " + (kq.stock || "-") +
      "\nKiểu số: " + (kq.kieuso || "-");
  } else if (kq.conHang === null) {
    msg += "\nLỗi: " + (kq.loi || "-");
  }
  ui.alert(msg);
}

function ckMenuCheckSheet() {
  var s = ckCheckSheet_();
  var msg = "Đã kiểm tra: " + s.tong + " số\n" +
    "Còn hàng: " + s.conHang + "\n" +
    "Đã bán: " + s.daBan + "\n" +
    "Không kiểm tra được: " + s.khongRo;
  if (s.conLai > 0) msg += "\nCòn lại chưa kiểm tra: " + s.conLai + " (chạy lại menu để tiếp tục)";
  SpreadsheetApp.getUi().alert(msg);
}

function ckMenuCreateSheet() {
  ckGetSheet_();
  SpreadsheetApp.getUi().alert("Đã tạo tab " + CK_SHEET_NAME + ". Dán số vào cột A rồi chọn “Kiểm tra cả tab”.");
}

function ckMenuClearCache() {
  ckClearCache_();
  SpreadsheetApp.getUi().alert("Đã xoá cache kết quả kiểm tra.");
}

// ==========================================
// WEB APP
// ==========================================
function ckJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = String(p.action || "check").trim().toLowerCase();

  try {
    if (action === "ping") {
      return ckJson_({
        status: "ok",
        service: "checkkho",
        commits: CK_COMMIT_VALUES,
        time: new Date().toISOString()
      });
    }

    if (action === "check") {
      var phones = ckParsePhones_(p);
      if (!phones.length) {
        return ckJson_({ status: "error", message: "Thiếu phone hoặc phones (VD: ?action=check&phone=0912345678)" });
      }
      if (phones.length > CK_MAX_PER_REQUEST) phones = phones.slice(0, CK_MAX_PER_REQUEST);

      var results = checkNhieuSo_(phones, { commits: ckParseCommits_(p.commits) });
      var resp = { status: "ok", count: results.length, data: results };
      // Tiện cho client chỉ kiểm tra 1 số: đưa luôn kết quả ra ngoài.
      // Bỏ các khoá trùng với vỏ response (status/count/data) để không đè mất
      // status:"ok" bằng status:"1" của dòng API.
      if (results.length === 1) {
        for (var k in results[0]) {
          if (!Object.prototype.hasOwnProperty.call(results[0], k)) continue;
          if (k === "status" || k === "count" || k === "data") continue;
          resp[k] = results[0][k];
        }
      }
      return ckJson_(resp);
    }

    if (action === "check_all" || action === "sheet" || p.all === "1") {
      var summary = ckCheckSheet_(Number(p.limit) > 0 ? Number(p.limit) : CK_MAX_ROWS_PER_RUN);
      return ckJson_({ status: "ok", summary: summary });
    }

    // Chẩn đoán: xem mức cam kết nào đang trả dữ liệu (VNPT có thể thêm mức mới)
    if (action === "diag") {
      var qd = ckBuildQuery_(p.phone || "0912345678") || { phone: "0912345678", prefix: "8491", search: "*68*" };
      var buckets = [];
      for (var b = 0; b < CK_COMMIT_VALUES.length; b++) {
        var rb = ckFetchCommit_(qd, CK_COMMIT_VALUES[b]);
        buckets.push({
          commit: CK_COMMIT_VALUES[b],
          ok: rb.ok,
          rows: rb.ok ? rb.rows.length : 0,
          error: rb.error || null
        });
      }
      return ckJson_({
        status: "ok",
        phone: qd.phone,
        prefix: qd.prefix,
        search: qd.search,
        apiAlive: ckApiAlive_(),
        buckets: buckets
      });
    }

    return ckJson_({ status: "error", message: "action không hợp lệ: " + action });
  } catch (err) {
    return ckJson_({
      status: "error",
      message: err && err.message ? err.message : String(err)
    });
  }
}

function doPost(e) {
  return doGet(e);
}
