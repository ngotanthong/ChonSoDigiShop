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

function doGet(e) {
  var action = e.parameter.action;
  var user = e.parameter.user;
  var deviceId = e.parameter.deviceId;
  var userAgent = e.parameter.userAgent || "";
  
  if (!user) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing user" }))
                         .setMimeType(ContentService.MimeType.JSON);
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
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "logout") {
    if (userRowIndex !== -1) {
      var currentStatus = sheet.getRange(userRowIndex, 5).getValue().toString();
      if (currentStatus !== "Hết hạn") {
        sheet.getRange(userRowIndex, 5).setValue("Offline");
        sendTelegramMessage("👋 <b>ĐÃ ĐĂNG XUẤT:</b>\n👤 User: <code>" + user + "</code>");
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
                       .setMimeType(ContentService.MimeType.JSON);
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
const ALERT_MIN_SCORE = 50; // Điểm tối thiểu gửi thông báo (Hạ xuống 35 để kiểm tra test dễ dàng hơn, sau này có thể tăng lên 50)
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
  const commits = ['0', '100000', '150000', '200000', '400000'];
  
  Logger.log("Bắt đầu quét kho số VNPT...");
  
  // Chuẩn bị các request song song cực kỳ nhanh
  const requests = [];
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
  
  // Tải dữ liệu song song từ VNPT API
  const responses = UrlFetchApp.fetchAll(requests);
  const allRawData = [];
  
  responses.forEach((res, index) => {
    try {
      const code = res.getResponseCode();
      if (code === 200) {
        const json = JSON.parse(res.getContentText());
        if (json.errorCode === 0 && json.data) {
          allRawData.push(...json.data);
        }
      } else {
        Logger.log("Lỗi HTTP " + code + " khi gọi request index " + index);
      }
    } catch (e) {
      Logger.log("Lỗi parse dữ liệu: " + e.message);
    }
  });
  
  Logger.log("Đã quét được tổng cộng " + allRawData.length + " số trong kho.");
  
  // Loại bỏ trùng lặp số
  const uniqueSims = {};
  allRawData.forEach(item => {
    const fNum = formatNumber(item.so_tb);
    if (!uniqueSims[fNum]) {
      uniqueSims[fNum] = item;
    }
  });
  
  const vipList = [];
  
  // Chấm điểm AI cho từng số
  for (const fNum in uniqueSims) {
    const item = uniqueSims[fNum];
    const aiResult = analyzeSIM(fNum);
    
    // Chỉ chọn các số đạt từ điểm sàn cấu hình trở lên
    if (aiResult.score >= ALERT_MIN_SCORE) {
      vipList.push({
        so_tb: fNum,
        monthly: item.monthly,
        commitment: item.commitment,
        score: aiResult.score,
        reasons: aiResult.reasonsArr.join(" + ")
      });
    }
  }
  
  Logger.log("Tìm thấy " + vipList.length + " số siêu đẹp đạt tiêu chuẩn.");
  
  if (vipList.length === 0) return;
  
  // Lấy lịch sử số đã thông báo từ PropertiesService để tránh trùng lặp
  const scriptProperties = PropertiesService.getScriptProperties();
  let notifiedSims = [];
  try {
    const rawList = scriptProperties.getProperty("NOTIFIED_VIP_SIMS");
    if (rawList) notifiedSims = JSON.parse(rawList);
  } catch (e) {}
  
  let newNotifiedCount = 0;
  
  // Gửi thông báo cho từng số đẹp mới phát hiện
  vipList.forEach(sim => {
    if (notifiedSims.indexOf(sim.so_tb) === -1) {
      // Số mới hoàn toàn chưa từng thông báo!
      sendTelegramNotification(sim);
      notifiedSims.push(sim.so_tb);
      newNotifiedCount++;
    }
  });
  
  // Giới hạn lịch sử lưu trữ 500 số cuối cùng để tránh quá tải bộ nhớ
  if (notifiedSims.length > 500) {
    notifiedSims = notifiedSims.slice(-500);
  }
  
  // Lưu lại lịch sử mới
  scriptProperties.setProperty("NOTIFIED_VIP_SIMS", JSON.stringify(notifiedSims));
  
  Logger.log("Đã gửi thêm " + newNotifiedCount + " thông báo SIM VIP mới về Telegram.");
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
  const isFree = !sim.monthly || sim.monthly == 0 || sim.monthly === "0";
  const price = Number(sim.monthly) || 0;
  const priceText = isFree ? "0 đ/tháng" : price.toLocaleString() + " đ/tháng";
  const commitText = (sim.commitment && sim.commitment > 0) ? "Cam kết " + sim.commitment + " tháng" : "Không cam kết cước";
  
  const fPhone = formatPhoneDisplay(sim.so_tb); // Áp dụng định dạng hiển thị đẹp
  
  const messageText = 
    "🔔 *[AI PHÁT HIỆN SIM VIP MỚI]*\n\n" +
    "📱 *Số điện thoại:* `" + fPhone + "`\n" +
    "⭐ *Điểm số AI:* `" + sim.score + " Điểm`\n" +
    "✨ *Đặc điểm:* " + sim.reasons + "\n" +
    "💵 *Cước cam kết:* " + priceText + "\n" +
    "⏳ *Thời hạn:* " + commitText + "\n" +
    "🤵 *Mua SIM:* LH nhân viên\n" +
    "──────────────────\n" +
    "👉 _Mở web chốt cọc ngay lập tức kẻo lỡ!_";
    
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
function analyzeSIM(numStr) {
  let score = 0;
  let categories = [];
  let reasons = [];
  
  // 1. Tứ Quý
  if (/(.)\1{3}$/.test(numStr)) {
    score += 50;
    categories.push('tuquy');
    reasons.push('Tứ Quý');
  }
  // 2. Tam Hoa
  else if (/(.)\1{2}$/.test(numStr)) {
    score += 30;
    categories.push('tamhoa');
    reasons.push('Tam Hoa');
  }
  
  // 3. Lộc Phát
  if (/(168|868)$/.test(numStr)) {
    score += 35;
    categories.push('locphat');
    reasons.push('Phát Lộc Phát');
  } else if (/(68|86)$/.test(numStr)) {
    score += 25;
    categories.push('locphat');
    reasons.push('Lộc Phát');
  }
  
  // 4. Số Tiến
  if (/(0123|1234|2345|3456|4567|5678|6789)$/.test(numStr)) {
    score += 35;
    categories.push('sotien');
    reasons.push('Tiến Lên Đẹp');
  } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
    score += 15;
    categories.push('sotien');
    reasons.push('Số Tiến');
  }
  
  // 5. Số Lặp (Taxi, Lặp Kép, Lặp Cặp)
  let isLap = false;
  if (/(\d{2})\1\1$/.test(numStr)) {
    score += 45;
    categories.push('solap');
    reasons.push('Taxi Đẹp');
    isLap = true;
  } else if (/(\d{3})\1$/.test(numStr)) {
    score += 40;
    categories.push('solap');
    reasons.push('Taxi Đẹp');
    isLap = true;
  } else if (/(\d)\1(\d)\2$/.test(numStr) && numStr.slice(-2, -1) !== numStr.slice(-1)) {
    score += 25;
    categories.push('solap');
    reasons.push('Lặp Kép');
    isLap = true;
  } else if (/(\d{2})\1$/.test(numStr)) {
    score += 20;
    categories.push('solap');
    reasons.push('Lặp Cặp');
    isLap = true;
  }
  
  // 5.5. Số Gánh / Số Đảo
  if (!isLap) {
    const matchGanhCap = numStr.match(/(\d{2})(\d{2})\1$/);
    if (matchGanhCap && Math.abs(parseInt(matchGanhCap[1]) - parseInt(matchGanhCap[2])) <= 2) {
      score += 30;
      categories.push('soganh');
      reasons.push('Gánh Cặp (AB CD AB)');
    } else if (/(\d)(\d)\2\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) {
      score += 25;
      categories.push('soganh');
      reasons.push('Gánh Đảo (ABBA)');
    } else if (/(\d)(\d)\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) {
      score += 15;
      categories.push('soganh');
      reasons.push('Gánh (ABA)');
    }
  }
  
  // 5.7. Cặp Tiến
  const last4Digits = numStr.slice(-4);
  if (last4Digits.length === 4) {
    const d1 = parseInt(last4Digits[0]);
    const d2 = parseInt(last4Digits[1]);
    const d3 = parseInt(last4Digits[2]);
    const d4 = parseInt(last4Digits[3]);
    if (d1 === d3 && d4 > d2) {
      score += 15;
      categories.push('captien');
      reasons.push('Cặp Tiến');
    }
  }
  
  // 6. Đuôi Đẹp phong thủy
  if (/(79|39)$/.test(numStr)) {
    score += 20;
    categories.push('duoidep');
    categories.push('phongthuy');
    reasons.push('Thần Tài');
  } else if (/(38|78)$/.test(numStr)) {
    score += 15;
    categories.push('duoidep');
    categories.push('phongthuy');
    reasons.push('Ông Địa');
  }
  
  // 7. Tổng nút
  const last4 = numStr.slice(-4);
  const sum4 = last4.split('').reduce(function(acc, val) { return acc + parseInt(val); }, 0);
  const nut = sum4 % 10;
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
    reasons.push('Số Sạch (không 4,7)');
  }
  
  return {
    score: score,
    categories: categories,
    reasonsArr: reasons
  };
}
```
