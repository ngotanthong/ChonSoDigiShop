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
var TELEGRAM_BOT_TOKEN = "ĐIỀN_TOKEN_BOT_VÀO_ĐÂY"; 
var TELEGRAM_CHAT_ID = "ĐIỀN_CHAT_ID_VÀO_ĐÂY";

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
