# HƯỚNG DẪN CẤU HÌNH GOOGLE SHEETS & GOOGLE APPS SCRIPT (KHOÁ THIẾT BỊ & HẠN DÙNG TỰ ĐỘNG)

Để kích hoạt tính năng **Khóa cứng thiết bị cố định (Device Binding)** và **Tự động khóa tài khoản khi hết hạn (Subscription Expiry)**, bạn làm theo các bước sau:

---

## 📅 Bước 1: Tạo Google Sheet mới
1. Truy cập vào [Google Sheets](https://docs.google.com/spreadsheets/) và tạo một Trang tính mới trống.
2. Đặt tên cho Trang tính (Ví dụ: `QuanLyThietBi_KhoSim`).
3. Đặt tên cho hàng tiêu đề đầu tiên ở các cột A, B, C, D, E, F như sau:
   *   **Cột A**: `Username` (Tên đăng nhập)
   *   **Cột B**: `Device ID` (Mã thiết bị đang hoạt động)
   *   **Cột C**: `Device Info` (Thông tin trình duyệt/thiết bị)
   *   **Cột D**: `Last Active` (Thời gian hoạt động cuối)
   *   **Cột E**: `Status` (Trạng thái - *Online/Offline/Locked/Hết hạn*)
   *   **Cột F**: `Expiration Date` (Ngày hết hạn - *Định dạng Năm-Tháng-Ngày, ví dụ: 2026-06-30*)

---

## 🛠️ Bước 2: Dán mã Google Apps Script
1. Tại file Google Sheet vừa tạo, anh nhấn vào menu **Tiện ích rộng (Extensions)** -> Chọn **Apps Script**.
2. Xóa sạch mọi mã mặc định trong khung soạn thái `Mã.gs` (nếu có).
3. Copy toàn bộ đoạn mã bên dưới và dán vào:

```javascript
// ==========================================
// CẤU HÌNH BOT TELEGRAM (BỎ TRỐNG NẾU KHÔNG DÙNG)
// ==========================================
var TELEGRAM_BOT_TOKEN = "8985605068:AAHWSdxaHnGgJ9H41YFToGzgSxAJk90vIQs"; 
var TELEGRAM_CHAT_ID = "7007784178";

function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_BOT_TOKEN === "ĐIỀN_TOKEN_BOT_VÀO_ĐÂY") return;
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = {
    "chat_id": TELEGRAM_CHAT_ID,
    "text": text,
    "parse_mode": "HTML"
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {}
}

function getPinnedSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName("PinnedSIMs");
  if (!pSheet) {
    pSheet = ss.insertSheet("PinnedSIMs");
    pSheet.appendRow(["User", "Phone", "SIM Data", "Pinned At"]);
  }
  return pSheet;
}

function doGet(e) {
  // CORS header helper
  function makeResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }

  var action = e.parameter.action;
  var user = e.parameter.user;
  var deviceId = e.parameter.deviceId;
  var userAgent = e.parameter.userAgent || "";
  
  if (!user) {
    return makeResponse({ status: "error", message: "Missing user" });
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  // Tìm dòng tương ứng với user
  var userRowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === user.toLowerCase()) {
      userRowIndex = i + 1;
      break;
    }
  }
  
  var now = new Date();
  
  if (action === "login" || action === "check") {
    if (userRowIndex !== -1) {
      var currentActiveDevice = data[userRowIndex - 1][1];
      var status = data[userRowIndex - 1][4] || "";
      var expiryVal = data[userRowIndex - 1][5]; // Cột F
      
      // 1. Kiểm tra ngày hết hạn thuê bao
      if (expiryVal) {
        var expiryDate = new Date(expiryVal);
        expiryDate.setHours(23, 59, 59, 999); // Đặt giờ hết hạn là cuối ngày
        
        if (now.getTime() > expiryDate.getTime()) {
          // Tự động ghi nhận Hết hạn lên Sheet
          if (status.toString().toLowerCase() !== "hết hạn") {
            sheet.getRange(userRowIndex, 5).setValue("Hết hạn");
            sendTelegramMessage("⛔️ <b>TÀI KHOẢN HẾT HẠN:</b>\n👤 User: <code>" + user + "</code>\n⏰ Đã khóa tự động.");
          }
          return ContentService.createTextOutput(JSON.stringify({ 
            status: "expired", 
            message: "Tài khoản của bạn đã hết hạn sử dụng! Vui lòng liên hệ Admin qua SĐT 0947.050.848 để gia hạn." 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      // 2. Kiểm tra tài khoản bị Admin khóa hoặc đã ghi nhận hết hạn
      if (status.toString().toLowerCase() === "locked" || status.toString().toLowerCase() === "bị khóa" || status.toString().toLowerCase() === "hết hạn") {
        if (action === "login") {
            sendTelegramMessage("🚫 <b>TRUY CẬP TÀI KHOẢN BỊ KHÓA:</b>\n👤 User: <code>" + user + "</code>\n📱 Cố gắng đăng nhập từ: " + userAgent);
        }
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "locked", 
          message: status.toString().toLowerCase() === "hết hạn" ? "Tài khoản của bạn đã hết hạn sử dụng! Vui lòng liên hệ Admin qua SĐT 0947.050.848 để gia hạn." : "Tài khoản của bạn đã bị khóa! Vui lòng liên hệ SĐT 0947.050.848 để được hỗ trợ." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      if (action === "login") {
        // Kiểm tra liên kết thiết bị cố định
        if (currentActiveDevice && currentActiveDevice !== deviceId) {
          sendTelegramMessage("⚠️ <b>CẢNH BÁO THIẾT BỊ LẠ:</b>\n👤 User: <code>" + user + "</code>\n📱 Đăng nhập từ: " + userAgent + "\n<i>(Đã bị chặn do khác thiết bị gốc)</i>");
          return ContentService.createTextOutput(JSON.stringify({ 
            status: "device_mismatch", 
            message: "Tài khoản này đã được liên kết cố định với một thiết bị khác! Vui lòng liên hệ Admin qua SĐT 0947.050.848 để mở khóa." 
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        // Nếu thiết bị chưa liên kết (trống), thực hiện liên kết cố định
        if (!currentActiveDevice) {
          sheet.getRange(userRowIndex, 2).setValue(deviceId);
          sheet.getRange(userRowIndex, 3).setValue(userAgent);
          sheet.getRange(userRowIndex, 5).setValue("Online");
          sendTelegramMessage("🔒 <b>ĐÃ KHÓA THIẾT BỊ MỚI:</b>\n👤 User: <code>" + user + "</code>\n📱 Trình duyệt: " + userAgent);
        } else {
          sheet.getRange(userRowIndex, 5).setValue("Online");
          sendTelegramMessage("✅ <b>ĐĂNG NHẬP THÀNH CÔNG:</b>\n👤 User: <code>" + user + "</code>");
        }
        
        sheet.getRange(userRowIndex, 4).setValue(now);
      } else {
        // check
        if (currentActiveDevice !== deviceId) {
          return ContentService.createTextOutput(JSON.stringify({ 
            status: "logged_out", 
            message: "Mã thiết bị không khớp với liên kết cố định!" 
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        sheet.getRange(userRowIndex, 4).setValue(now);
      }
    } else {
      // Thêm mới tài khoản và liên kết cố định thiết bị hiện tại
      sheet.appendRow([user, deviceId, userAgent, now, "Online", ""]);
      sendTelegramMessage("🆕 <b>TÀI KHOẢN MỚI ĐĂNG NHẬP:</b>\n👤 User: <code>" + user + "</code>\n📱 Trình duyệt: " + userAgent);
    }
    return makeResponse({ status: "ok" });
  }
  
  if (action === "logout") {
    if (userRowIndex !== -1) {
      var currentStatus = sheet.getRange(userRowIndex, 5).getValue().toString();
      if (currentStatus !== "Hết hạn") {
        sheet.getRange(userRowIndex, 5).setValue("Offline");
        sendTelegramMessage("👋 <b>ĐÃ ĐĂNG XUẤT:</b>\n👤 User: <code>" + user + "</code>");
      }
    }
    return makeResponse({ status: "ok" });
  }

  // ---- PINNED SIMs actions ----
  if (action === "pin") {
    var phone = e.parameter.phone;
    var pinSheet = getPinnedSheet();
    var pData = pinSheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < pData.length; i++) {
      if (pData[i][0].toString().toLowerCase() === user.toLowerCase() && pData[i][1] === phone) {
        found = true;
        pinSheet.getRange(i + 1, 4).setValue(new Date());
        break;
      }
    }
    if (!found) {
      pinSheet.appendRow([user, phone, "", new Date()]);
      sendTelegramMessage("📌 <b>TEST GHIM SỐ:</b>\n👤 User: <code>" + user + "</code>\n📱 Số: " + phone + "\nĐã lưu thành công vào Sheet!");
    }
    return makeResponse({ status: "ok" });
  }

  if (action === "unpin") {
    var phone = e.parameter.phone;
    var pinSheet = getPinnedSheet();
    var pData = pinSheet.getDataRange().getValues();
    for (var i = pData.length - 1; i >= 1; i--) {
      if (pData[i][0].toString().toLowerCase() === user.toLowerCase() && pData[i][1] === phone) {
        pinSheet.deleteRow(i + 1);
      }
    }
    return makeResponse({ status: "ok" });
  }

  if (action === "get_pinned") {
    var pinSheet = getPinnedSheet();
    var pData = pinSheet.getDataRange().getValues();
    var results = [];
    var isAdmin = (user.toLowerCase() === "admin");
    for (var i = 1; i < pData.length; i++) {
      var rowUser = pData[i][0].toString();
      if (isAdmin || rowUser.toLowerCase() === user.toLowerCase()) {
        try {
          var simObj = pData[i][2] ? JSON.parse(pData[i][2]) : null;
          if (!simObj || typeof simObj !== "object") {
              simObj = {
                  fNum: pData[i][1].toString(),
                  so_tb: pData[i][1].toString().replace(/\s/g, ""),
                  monthly: 0,
                  commitment: 0,
                  ai: { score: 0, reasonText: "Đã ghim", highlight: [] }
              };
          }
          simObj._pinnedBy = rowUser;
          results.push(simObj);
        } catch(ex) {
          // Fallback an toàn nếu có lỗi
          results.push({
              fNum: pData[i][1].toString(),
              ai: { score: 0, reasonText: "Lỗi dữ liệu", highlight: [] },
              _pinnedBy: rowUser
          });
        }
      }
    }
    results.reverse();
    return makeResponse({ status: "ok", data: results });
  }

  return makeResponse({ status: "error", message: "Invalid action" });
}

function doPost(e) {
  return doGet(e);
}
```

4. Nhấn biểu tượng **Lưu dự án (Save project)** (hình đĩa mềm) hoặc bấm `Cmd + S` / `Ctrl + S`.

---

## 🌐 Bước 3: Triển khai thành Web App (Lấy link API)
1. Ở góc trên cùng bên phải trang Apps Script, anh nhấn nút **Triển khai (Deploy)** -> Chọn **Triển khai mới (New deployment)**.
2. Tại bảng hiện ra, nhấn vào biểu tượng **Bánh răng cài đặt** bên cạnh "Chọn loại" -> Chọn **Ứng dụng Web (Web app)**.
3. Cấu hình 3 dòng như sau:
   *   **Mô tả**: Gõ bất kỳ, ví dụ `Anti Share va Het Han Kho Sim`.
   *   **Thực thi dưới dạng (Execute as)**: Chọn **Tôi (Me)**.
   *   **Ai có quyền truy cập (Who has access)**: Chọn **Mọi người (Anyone)**. *(Lưu ý: Dòng này bắt buộc phải là "Anyone" để trang web có thể gọi lên).*
4. Nhấn nút **Triển khai (Deploy)** ở góc dưới.
5. Nếu Google hỏi cấp quyền truy cập tài khoản, anh nhấn **Cấp quyền truy cập (Authorize access)** -> Chọn tài khoản Google của anh -> Nhấn **Nâng cao (Advanced)** ở góc dưới -> Chọn **Đi tới dự án không an toàn (Go to project (unsafe))** -> Nhấn **Cho phép (Allow)**.
6. Sau khi triển khai xong, Google sẽ cung cấp một đường dẫn tại ô **URL ứng dụng web**.
7. Anh **Copy đường dẫn này** (Nó có dạng: `https://script.google.com/macros/s/XXXXXX/exec`).
8. Mở file [index.html](file:///Users/ngotanthong/Dự án VibeCode/ChonSoDigiShop/index.html) trong dự án của anh, tìm dòng cấu hình đầu thẻ script `const GAS_API_URL = '';` và dán đường dẫn này vào giữa hai dấu nháy đơn!

---

## 🎯 Cách gia hạn hoặc đặt lại tài khoản
*   **Khi bán tài khoản mới (Ví dụ: 1 tháng)**: Anh nhập ngày hết hạn vào **Cột F** theo định dạng `Năm-Tháng-Ngày` (Ví dụ: `2026-06-30` hoặc dùng công thức `=TODAY()+30`).
*   **Khi khách hàng chuyển khoản gia hạn**: Anh chỉ cần mở Google Sheet ra, sửa lại ngày hết hạn ở **Cột F** xa hơn trong tương lai, và gõ chữ `Online` vào **Cột E (Status)** là xong! Khách hàng có thể truy cập lại bình thường.
*   **Khi nhân viên đổi máy mới**: Anh chỉ cần mở Google Sheet, **xóa trắng ô Device ID (Cột B)** tương ứng. Lần đăng nhập tiếp theo họ dùng thiết bị mới sẽ tự động được khóa cố định.
*   **Khi muốn khóa vĩnh viễn tài khoản**: Anh gõ chữ `Locked` vào cột **Status (Cột E)**.

---

# PHẦN 2: KỊCH BẢN TỰ ĐỘNG QUÉT SIM VIP GỬI TELEGRAM

Anh có thể tạo thêm một dự án Apps Script thứ 2 (hoặc dán chung vào dự án hiện tại nhưng ở một file script khác) để thiết lập kịch bản tự động lùng sục SIM VIP trên hệ thống VNPT và tự động báo về Telegram!

Kịch bản dưới đây **đã được cập nhật luật chấm điểm Gánh Cặp (AB CD AB)** mới nhất và **tự động tách số điện thoại bằng dấu cách (VD: 091 234 5678)** cho dễ nhìn khi gửi vào Telegram.

```javascript
// =========================================================================
// CẤU HÌNH BOT TELEGRAM CỦA BẠN TẠI ĐÂY
// =========================================================================
  const TELEGRAM_BOT_TOKEN = "8985605068:AAHWSdxaHnGgJ9H41YFToGzgSxAJk90vIQs";
  const TELEGRAM_CHAT_ID = "7007784178";
  const ALERT_MIN_SCORE = 45; // Điểm tối thiểu gửi thông báo (Hạ xuống 35 để kiểm tra test dễ dàng hơn, sau này có thể tăng lên 50)
  // =========================================================================

  /**
   * HÀM CHẨN ĐOÁN KẾT NỐI
   * Chạy hàm này trước tiên để xem máy chủ Google Apps Script có bị VNPT chặn hay không!
   */
  function testVnptApiConnection() {
    const url = "https://digishop.vnpt.vn/apiprod/v2/simso/num_search?search=&prefix=8491&commit=0";
    Logger.log("Bắt đầu chẩn đoán kết nối tới VNPT API...");
    
    const options = {
      "method": "get",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://digishop.vnpt.vn",
        "Referer": "https://digishop.vnpt.vn/"
      },
      "muteHttpExceptions": true
    };
    
    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      const body = res.getContentText();
      
      Logger.log("Mã phản hồi HTTP: " + code);
      
      if (code === 200) {
        const json = JSON.parse(body);
        if (json.errorCode === 0) {
          const count = json.data ? json.data.length : 0;
          Logger.log("✅ KẾT NỐI THÀNH CÔNG! Quét mẫu thành công và nhận được " + count + " số.");
          sendTelegramDirect("✅ Apps Script chẩn đoán kết nối VNPT thành công! Kết nối thông suốt, đã sẵn sàng hoạt động quét ngầm.");
        } else {
          Logger.log("❌ VNPT API trả về mã lỗi: " + json.message);
          sendTelegramDirect("❌ VNPT API trả về lỗi hệ thống: " + json.message);
        }
      } else if (code === 403 || code === 503) {
        Logger.log("❌ BỊ TƯỜNG LỬA CHẶN! VNPT Cloudflare/WAF đã chặn dải IP của Google Apps Script (HTTP " + code + ").");
        sendTelegramDirect("❌ Máy chủ Google Cloud bị tường lửa VNPT chặn kết nối (Mã lỗi HTTP " + code + ").");
      } else {
        Logger.log("❌ Lỗi kết nối khác: HTTP " + code);
        sendTelegramDirect("❌ Lỗi kết nối khác: HTTP " + code);
      }
    } catch (err) {
      Logger.log("❌ Lỗi đường truyền mạng: " + err.message);
      sendTelegramDirect("❌ Lỗi đường truyền mạng Apps Script: " + err.message);
    }
  }

  /**
   * Hàm gửi tin nhắn trực tiếp không qua bộ lọc điểm
   */
  function sendTelegramDirect(txt) {
    const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
    const payload = {
      "chat_id": TELEGRAM_CHAT_ID,
      "text": txt
    };
    UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });
  }

  /**
   * Hàm chính thực hiện quét toàn kho VNPT
   * (Cấu hình Trigger để hàm này chạy tự động mỗi 15-30 phút)
   */
  function runAutoScanVipSims() {
    const prefixes = ['8491', '8494', '8488', '8481', '8482', '8483', '8484', '8485'];
    const commits = ['0', '100000', '150000', '200000'];
    const MULTIPLIER = 2; // Giảm xuống 2 để tránh lỗi "Service invoked too many times" (Giới hạn 20.000 request/ngày của Google)
    
    Logger.log("Bắt đầu chiến dịch DeepSearch kho số VNPT...");
    
    // 1. Lấy lịch sử số đã thông báo từ PropertiesService để tránh gửi trùng
    const scriptProperties = PropertiesService.getScriptProperties();
    let notifiedSims = [];
    try {
      const rawList = scriptProperties.getProperty("NOTIFIED_VIP_SIMS");
      if (rawList) notifiedSims = JSON.parse(rawList);
    } catch (e) {}

    const MAX_EXECUTION_TIME = 1.5 * 60 * 1000; // Rút ngắn còn 1.5 phút để tiết kiệm Quota Google
    const startTime = Date.now();
    let loopCount = 0;
    let totalNewVipFound = 0;

    // 2. Bắt đầu vòng lặp cày nát API
    while (Date.now() - startTime < MAX_EXECUTION_TIME) {
      loopCount++;
      Logger.log(`--- Đang chạy vòng lặp DeepSearch thứ ${loopCount} ---`);
      
      const requests = [];
      for (let i = 0; i < MULTIPLIER; i++) {
        prefixes.forEach(pref => {
          commits.forEach(c => {
            requests.push({
              url: "https://digishop.vnpt.vn/apiprod/v2/simso/num_search?search=&prefix=" + pref + "&commit=" + c,
              method: "get",
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://digishop.vnpt.vn",
                "Referer": "https://digishop.vnpt.vn/"
              },
              muteHttpExceptions: true
            });
          });
        });
      }
      
      // Tải dữ liệu song song nhưng chia thành các mẻ nhỏ để tránh lỗi "Service invoked too many times" của Google
      const responses = [];
      const BATCH_SIZE = 40; 
      for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        const batch = requests.slice(i, i + BATCH_SIZE);
        try {
          const batchResponses = UrlFetchApp.fetchAll(batch);
          responses.push(...batchResponses);
        } catch (e) {
          Logger.log("Lỗi tải mẻ nhỏ: " + e.message);
        }
        Utilities.sleep(1000); // Tạm nghỉ 1s giữa các mẻ nhỏ theo gợi ý của hệ thống
      }
      const allRawData = [];
      let isRateLimited = false;
      
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        try {
          const code = res.getResponseCode();
          if (code === 429 || code === 403) {
            isRateLimited = true;
            break; // Thoát khỏi vòng lặp kiểm tra kết quả ngay lập tức
          }
          if (code === 200) {
            const json = JSON.parse(res.getContentText());
            if (json.errorCode === 0 && json.data) {
              allRawData.push(...json.data);
            }
          }
        } catch (e) {}
      }
      
      // Rút lui chiến thuật nếu bị chặn
      if (isRateLimited) {
        Logger.log("⚠️ CẢNH BÁO: VNPT đang chặn Rate Limit (Lỗi 429). Ngừng ngay vòng lặp để bảo vệ IP!");
        break; 
      }
      
      // Lọc trùng lặp cục bộ trong mẻ này
      const uniqueSims = {};
      allRawData.forEach(item => {
        const fNum = formatNumber(item.so_tb);
        if (!uniqueSims[fNum]) {
          uniqueSims[fNum] = item;
        }
      });
      
      let meVipMoi = 0;
      
      // Chấm điểm và gửi ngay Telegram
      for (const fNum in uniqueSims) {
        // Nếu số đã từng báo cáo rồi thì bỏ qua luôn, khỏi chấm điểm cho nhẹ máy
        if (notifiedSims.indexOf(fNum) !== -1) continue;

        const item = uniqueSims[fNum];
        const aiResult = analyzeSIM(fNum, item.monthly);
        
        if (aiResult.score >= ALERT_MIN_SCORE) {
          const simData = {
            so_tb: fNum,
            monthly: item.monthly,
            commitment: item.commitment,
            score: aiResult.score,
            reasons: aiResult.reasonsArr.join(" + ")
          };
          
          // Gửi Telegram
          sendTelegramNotification(simData);
          
          // Đánh dấu đã báo cáo
          notifiedSims.push(fNum);
          meVipMoi++;
          totalNewVipFound++;
        }
      }
      
      Logger.log(`Kết thúc vòng ${loopCount}. Bắt được ${meVipMoi} số VIP. Tạm nghỉ 10 giây...`);
      
      // 3. Tạm nghỉ 10 giây để đánh lừa WAF của VNPT trước khi cào mẻ mới
      Utilities.sleep(10000); 
    }
    
    // 4. Kết thúc toàn bộ chiến dịch: Lưu lại danh sách đã báo cáo để giờ sau không báo trùng
    if (notifiedSims.length > 1000) {
      notifiedSims = notifiedSims.slice(-1000); // Tăng mức lưu trữ history lên 1000 số cho dư dả
    }
    scriptProperties.setProperty("NOTIFIED_VIP_SIMS", JSON.stringify(notifiedSims));
    
    Logger.log(`=== HOÀN TẤT DEEPSEARCH ===\nĐã chạy ${loopCount} vòng lặp. Tổng cộng thu hoạch được ${totalNewVipFound} số VIP siêu cấp!`);
  }

  /**
   * Định dạng số điện thoại hiển thị đẹp có dấu cách
   */
  function formatPhoneDisplay(numStr) {
    if (!numStr || numStr.length !== 10) return numStr;
    
    let dotIndexes = [];
    if (/(.)\1{4}$/.test(numStr)) {
      dotIndexes = [3, 5];
    } else if (/(.)\1{3}$/.test(numStr)) {
      dotIndexes = [3, 6];
    } else if (/(\d{3})\1$/.test(numStr)) {
      dotIndexes = [4, 7];
    } else if (/(\d{2})\1\1$/.test(numStr) || /(\d{2})\d{2}\1$/.test(numStr)) {
      dotIndexes = [4, 6, 8];
    } else if (/(\d{2})\1$/.test(numStr) || /(\d)\1(\d)\2$/.test(numStr) || /(\d)(\d)\2\1$/.test(numStr)) {
      dotIndexes = [3, 6, 8];
    } else {
      dotIndexes = [3, 6];
    }

    let str = '';
    for (let i = 0; i < numStr.length; i++) {
      if (dotIndexes.indexOf(i) !== -1) str += ' ';
      str += numStr[i];
    }
    return str;
  }

  /**
   * Gửi tin nhắn về Telegram dạng Markdown
   */
  function sendTelegramNotification(sim) {
    const isFree = (!sim.monthly || sim.monthly == 0 || sim.monthly === "0") && (!sim.commitment || sim.commitment == 0 || sim.commitment === "0");
    const price = Number(sim.monthly) || 0;
    const priceText = isFree ? "0 đ/tháng" : price.toLocaleString() + " đ/tháng";
    const commitText = (sim.commitment && sim.commitment > 0) ? "Cam kết " + sim.commitment + " tháng" : "Không cam kết cước";
    
    const fPhone = formatPhoneDisplay(sim.so_tb); // Áp dụng định dạng hiển thị đẹp
    
    const messageText = 
      "🔔 *[CÓ SIM VIP MỚI]*\n\n" +
      "📱 *Số điện thoại:* `" + fPhone + "`\n" +
      "✨ *Đặc điểm:* " + sim.reasons + "\n" +
      "💵 *Cước cam kết:* " + priceText + "\n" +
      "⏳ *Thời hạn:* " + commitText + "\n" +
      "👉 _Lh 0947 050 848 chốt ngay!_";
      
    const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
    const payload = {
      "chat_id": TELEGRAM_CHAT_ID,
      "text": messageText,
      "parse_mode": "Markdown"
    };
    
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    UrlFetchApp.fetch(url, options);
  }

  /**
   * Định dạng số điện thoại về dạng 0xxx
   */
  function formatNumber(num) {
    return num.indexOf('84') === 0 ? '0' + num.slice(2) : num;
  }

  /**
   * Bộ não AI Chấm điểm số đẹp (Đồng nhất 100% với Web)
   */
  function analyzeSIM(numStr, monthlyFee = 0) {
    let score = 0;
    let categories = [];
    let reasons = [];

    // Tứ Quý / Ngũ Quý Giữa
    if (/(.)\1{4}/.test(numStr.slice(0, -1))) { 
        score += 40;
        categories.push('tuquy');
        reasons.push('Ngũ Quý Giữa');
    } else if (/(.)\1{3}/.test(numStr.slice(0, -1))) {
        score += 30;
        categories.push('tuquy');
        reasons.push('Tứ Quý Giữa');
    }

    // 1. Tứ Quý (4 số giống nhau ở cuối)
    if (/(.)\1{3}$/.test(numStr)) {
        score += 50;
        categories.push('tuquy');
        reasons.push('Tứ Quý');
    }
    // 2. Tam Hoa (3 số giống nhau ở cuối)
    else if (/(.)\1{2}$/.test(numStr)) {
        score += 30;
        categories.push('tamhoa');
        reasons.push('Tam Hoa');
    }

    // 3. Lộc Phát (chứa 68, 86, 168, 868 ở cuối)
    if (/(168|868)$/.test(numStr)) {
        score += 35;
        categories.push('locphat');
        reasons.push('Phát Lộc Phát');
    } else if (/(68|86)$/.test(numStr)) {
        score += 25;
        categories.push('locphat');
        reasons.push('Lộc Phát');
    }

    // 4. Số Tiến (1234, 6789, 2345)
    if (/(0123|1234|2345|3456|4567|5678|6789)$/.test(numStr)) {
        score += 35;
        categories.push('sotien');
        reasons.push('Sảnh Tiến Lớn');
    } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
        score += 15;
        categories.push('sotien');
        reasons.push('Sảnh Tiến');
    }

    // 5. Số Lặp Cao Cấp (Taxi, Lặp Kép) & Lặp Thường (ABAB)
    let isLap = false;
    if (/(\d{2})\1\1$/.test(numStr)) { // ABABAB (Taxi 3 cặp)
        score += 60;
        categories.push('solap');
        reasons.push('Taxi Đẹp');
        isLap = true;
    } else if (/(\d{3})\1$/.test(numStr)) { // ABCABC (Taxi cụm 3)
        score += 55;
        categories.push('solap');
        reasons.push('Taxi Đẹp');
        isLap = true;
    } else if (/(\d)\1(\d)\2$/.test(numStr) && numStr.slice(-2, -1) !== numStr.slice(-1)) { // AABB
        score += 25;
        categories.push('solap');
        reasons.push('Lặp Kép');
        isLap = true;
    } else if (/(\d{2})\1$/.test(numStr)) { // ABAB
        score += 20;
        categories.push('solap');
        reasons.push('Lặp Cặp');
        isLap = true;
    }

    // 5.5. Số Gánh / Số Đảo (ABBA, ABA, AB CD AB)
    if (!isLap) {
        // Kiểm tra Cặp Tiến trước Gánh để không bị override sai
        const _ct6 = numStr.slice(-6);
        const _ct4 = numStr.slice(-4);
        const _p1_6 = parseInt(_ct6.slice(0, 2)), _p2_6 = parseInt(_ct6.slice(2, 4)), _p3_6 = parseInt(_ct6.slice(4, 6));
        const _d1_6 = _p2_6 - _p1_6, _d2_6 = _p3_6 - _p2_6;
        const _p1_4 = parseInt(_ct4.slice(0, 2)), _p2_4 = parseInt(_ct4.slice(2, 4));
        const _d_4 = _p2_4 - _p1_4;
        const isCaptienHere = (_d1_6 > 0 && _d1_6 <= 20 && _d1_6 === _d2_6) ||
            (_d_4 > 0 && _d_4 <= 20 && _p1_4 >= 10);

        if (!isCaptienHere) {
            // Kiểm tra Gánh Kép: 6 số cuối gồm 2 cụm ABA liền nhau (VD: 323262)
            const last6g = numStr.slice(-6);
            const g1 = last6g.slice(0, 3), g2 = last6g.slice(3, 6);
            const isABA = (s) => s.length === 3 && s[0] === s[2] && s[0] !== s[1];
            // Gánh kép có liên kết: chung số giữa (181 282), chung số ngoài (818 828), hoặc xen kẽ (181 818)
            if (isABA(g1) && isABA(g2) && (g1[1] === g2[1] || g1[0] === g2[0] || (g1[0] === g2[1] && g1[1] === g2[0]))) {
                score += 25;
                categories.push('soganh');
                reasons.push('Gánh Kép');
            } else {
                const matchGanhCap = numStr.match(/(\d{2})(\d{2})\1$/);
                if (matchGanhCap && Math.abs(parseInt(matchGanhCap[1]) - parseInt(matchGanhCap[2])) <= 2) { // AB CD AB (Gánh cặp 6 số gần nhau)
                    score += 30;
                    categories.push('soganh');
                    reasons.push('Gánh Cặp');
                } else if (/(\d)(\d)\2\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) { // ABBA
                    score += 25;
                    categories.push('soganh');
                    reasons.push('Gánh Đảo');
                } else if (/(\d)(\d)\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) { // ABA - hạ điểm
                    score += 8;
                    categories.push('soganh');
                    reasons.push('Gánh');
                }
            }
        }
    }

    // 6. Đuôi Đẹp phong thủy
    if (/(79|39)$/.test(numStr)) {
        score += 20;
        categories.push('duoidep');
        reasons.push('Thần Tài');
    } else if (/(38|78)$/.test(numStr)) {
        score += 15;
        categories.push('duoidep');
        reasons.push('Ông Địa');
    }

    // 7. Tổng nút
    const sum10 = numStr.split('').reduce((acc, val) => acc + parseInt(val), 0);
    const nut = sum10 % 10;
    if (nut >= 7) {
        let point = 5;
        if (nut === 9) {
            point = 10;
            categories.push('phongthuy');
        }
        score += point;
        reasons.push('Nút ' + nut);
    }

    // 8. Trừ điểm số kỵ / Cộng số sạch
    if (/49|53/.test(numStr)) {
        score -= 15;
    } else if (!/4/.test(numStr) && !/7/.test(numStr)) {
        score += 10;
        reasons.push('Không 4, 7');
    }

    // 9. Thuật toán "Số Ít Phím" (Dễ nhớ)
    const uniqueDigitsCount = new Set(numStr.split('')).size;
    if (uniqueDigitsCount <= 3) {
        score += 30;
        categories.push('denho');
        reasons.push('Siêu Dễ Nhớ');
    } else if (uniqueDigitsCount === 4) {
        score += 15;
        categories.push('denho');
        reasons.push('Dễ Nhớ');
    }

    // 10. Tiến Chẵn / Tiến Lẻ
    if (/(1357|3579)$/.test(numStr)) {
        score += 20;
        categories.push('sotien');
        reasons.push('Tiến Lẻ Đều');
    } else if (/(135|357|579)$/.test(numStr)) {
        score += 15;
        categories.push('sotien');
        reasons.push('Sảnh Tiến Lẻ');
    } else if (/(2468|0246)$/.test(numStr)) {
        score += 20;
        categories.push('sotien');
        reasons.push('Tiến Chẵn Đều');
    } else if (/(024|246|468)$/.test(numStr)) {
        score += 15;
        categories.push('sotien');
        reasons.push('Sảnh Tiến Chẵn');
    }

    // 10.5. Cặp Tiến nâng cao (phát hiện 2-3 cặp 2 số tiến đều)
    {
        // Kiểm tra 3 cặp đuôi 6 số (mạnh hơn)
        const last6 = numStr.slice(-6);
        let captienFound = false;
        if (last6.length === 6) {
            const p1 = parseInt(last6.slice(0, 2));
            const p2 = parseInt(last6.slice(2, 4));
            const p3 = parseInt(last6.slice(4, 6));
            const diff1 = p2 - p1;
            const diff2 = p3 - p2;
            // Cặp Tiến 3 Bậc đẹp: chỉ chấp nhận diff=10 (chục tròn: 10 20 30) hoặc diff=11 (đôi: 11 22 33)
            if ((diff1 === 10 || diff1 === 11) && diff1 === diff2) {
                score += 30;
                categories.push('captien');
                reasons.push('Cặp Tiến 3 Bậc');
                captienFound = true;
            }
        }

        // Kiểm tra 2 cặp đuôi 4 số (thông thường)
        if (!captienFound) {
            const last4 = numStr.slice(-4);
            const p1 = parseInt(last4.slice(0, 2));
            const p2 = parseInt(last4.slice(2, 4));
            const diff = p2 - p1;
            // Cặp Tiến đẹp: chỉ chấp nhận diff=10 (chục tròn: 20→30) hoặc diff=11 (đôi tăng dần: 22→33, 12→23)
            if ((diff === 10 || diff === 11) && p1 >= 10) {
                score += 15;
                categories.push('captien');
                reasons.push('Cặp Tiến');
            }
        }
    }

    // Cặp Đồng Đầu (VD: 60 63 68, 71 73)
    if (/(\d)\d\1\d\1\d$/.test(numStr) && !/(\d{2})\1\1$/.test(numStr)) {
        score += 25;
        categories.push('denho');
        reasons.push('Số Cặp');
    } else if (/(\d)\d\1\d$/.test(numStr) && !/(\d{2})\1$/.test(numStr)) {
        score += 15;
        categories.push('denho');
        reasons.push('Số Cặp');
    }

    // Taxi biến thể (VD: 168 468, 279 179)
    const taxiVarMatch = numStr.match(/(\d)(79|39|68|86|38|78)(\d)\2$/);
    if (taxiVarMatch && taxiVarMatch[1] !== taxiVarMatch[3]) {
        score += 45;
        categories.push('phongthuy');
        categories.push('solap');
        reasons.push(`Taxi Đuôi ${taxiVarMatch[2]}`);
    }

    // 11. Đầu Đuôi Tương Phùng
    const prefix3 = numStr.slice(0, 3);
    const prefix4 = numStr.slice(0, 4);

    if (numStr.endsWith(prefix4)) {
        score += 25;
        categories.push('denho');
        reasons.push('Đầu Đuôi Tương Phùng');
    } else if (numStr.endsWith(prefix3)) {
        score += 20;
        categories.push('denho');
        reasons.push('Đầu Đuôi Tương Phùng');
    }

    // 12. Độ bằng phẳng (Lộn xộn)
    let flipCount = 0;
    let lastDirection = 0;
    for (let i = 1; i < numStr.length; i++) {
        let diff = parseInt(numStr[i]) - parseInt(numStr[i - 1]);
        if (diff > 0) {
            if (lastDirection === -1) flipCount++;
            lastDirection = 1;
        } else if (diff < 0) {
            if (lastDirection === 1) flipCount++;
            lastDirection = -1;
        }
    }
    if (flipCount > 5) {
        score -= 10;
    } else if (flipCount <= 2 && uniqueDigitsCount >= 5) {
        score += 5;
    }

    // 13. Ưu tiên số Rẻ & Đẹp (Cam kết <= 100k) có từ 3 tag trở lên
    const fee = Number(monthlyFee) || 0;
    if (fee <= 100000) {
        if (reasons.length >= 4) {
            score += 20;
            categories.push('phongthuy');
            reasons.push('Rẻ & Siêu Đẹp');
        } else if (reasons.length === 3) {
            score += 10;
            categories.push('phongthuy');
            reasons.push('Rẻ & Đẹp');
        }
    }

    return {
        score: score,
        categories: categories,
        reasonsArr: reasons
    };
  }
```
