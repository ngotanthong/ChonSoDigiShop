# HƯỚNG DẪN CẤU HÌNH GOOGLE SHEETS & GOOGLE APPS SCRIPT (KHOÁ THIẾT BỊ CỐ ĐỊNH)

Để kích hoạt tính năng **Khóa cứng thiết bị cố định (Device Binding / Hardware Lock)**, bạn cần làm theo 3 bước cực kỳ đơn giản sau đây:

---

## 📅 Bước 1: Tạo Google Sheet mới
1. Truy cập vào [Google Sheets](https://docs.google.com/spreadsheets/) và tạo một Trang tính mới trống.
2. Đặt tên cho Trang tính (Ví dụ: `QuanLyThietBi_KhoSim`).
3. Đặt tên cho hàng tiêu đề đầu tiên ở các cột A, B, C, D, E như sau:
   *   **Cột A**: `Username`
   *   **Cột B**: `Device ID`
   *   **Cột C**: `Device Info`
   *   **Cột D**: `Last Active`
   *   **Cột E**: `Status`

---

## 🛠️ Bước 2: Dán mã Google Apps Script
1. Tại file Google Sheet vừa tạo, anh nhấn vào menu **Tiện ích rộng (Extensions)** -> Chọn **Apps Script**.
2. Xóa sạch mọi mã mặc định trong khung soạn thảo `Mã.gs` (nếu có).
3. Copy toàn bộ đoạn mã bên dưới và dán vào:

```javascript
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
  
  if (action === "login") {
    if (userRowIndex !== -1) {
      var currentActiveDevice = data[userRowIndex - 1][1];
      var status = data[userRowIndex - 1][4] || "";
      
      // 1. Kiểm tra tài khoản bị Admin khóa
      if (status.toString().toLowerCase() === "locked" || status.toString().toLowerCase() === "bị khóa") {
        return ContentService.createTextOutput(JSON.stringify({ status: "locked", message: "Tài khoản của bạn đã bị khóa bởi Admin!" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 2. Kiểm tra liên kết thiết bị cố định
      if (currentActiveDevice && currentActiveDevice !== deviceId) {
        // Có thiết bị khác đã liên kết và không trùng khớp -> CHẶN ĐĂNG NHẬP VĨNH VIỄN
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "device_mismatch", 
          message: "Tài khoản này đã được liên kết cố định với một thiết bị khác! Vui lòng liên hệ Admin để mở khóa." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Nếu thiết bị chưa liên kết (trống), thực hiện liên kết cố định
      if (!currentActiveDevice) {
        sheet.getRange(userRowIndex, 2).setValue(deviceId);
        sheet.getRange(userRowIndex, 3).setValue(userAgent);
        sheet.getRange(userRowIndex, 5).setValue("Online");
      }
      
      sheet.getRange(userRowIndex, 4).setValue(now);
    } else {
      // Thêm mới tài khoản và liên kết cố định thiết bị hiện tại
      sheet.appendRow([user, deviceId, userAgent, now, "Online"]);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "check") {
    if (userRowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ status: "logged_out", message: "Tài khoản chưa từng đăng nhập!" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    var currentActiveDevice = data[userRowIndex - 1][1];
    var status = data[userRowIndex - 1][4] || "";
    
    if (status.toString().toLowerCase() === "locked" || status.toString().toLowerCase() === "bị khóa") {
      return ContentService.createTextOutput(JSON.stringify({ status: "locked", message: "Tài khoản của bạn đã bị khóa bởi Admin!" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (currentActiveDevice !== deviceId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "logged_out", message: "Mã thiết bị không khớp với liên kết cố định!" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Cập nhật tương tác cuối
    sheet.getRange(userRowIndex, 4).setValue(now);
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "logout") {
    // Chỉ cập nhật trạng thái sang Offline trên Sheet để Admin theo dõi
    if (userRowIndex !== -1) {
      sheet.getRange(userRowIndex, 5).setValue("Offline");
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
   *   **Mô tả**: Gõ bất kỳ, ví dụ `Anti Share Sim`.
   *   **Thực thi dưới dạng (Execute as)**: Chọn **Tôi (Me / chagtraitroidah@gmail.com)**.
   *   **Ai có quyền truy cập (Who has access)**: Chọn **Mọi người (Anyone)**. *(Lưu ý: Dòng này bắt buộc phải là "Anyone" để trang web có thể gọi lên).*
4. Nhấn nút **Triển khai (Deploy)** ở góc dưới.
5. Nếu Google hỏi cấp quyền truy cập tài khoản, anh nhấn **Cấp quyền truy cập (Authorize access)** -> Chọn tài khoản Google của anh -> Nhấn **Nâng cao (Advanced)** ở góc dưới -> Chọn **Đi tới dự án không an toàn (Go to project (unsafe))** -> Nhấn **Cho phép (Allow)**.
6. Sau khi triển khai xong, Google sẽ cung cấp một đường dẫn tại ô **URL ứng dụng web**.
7. Anh **Copy đường dẫn này** (Nó có dạng: `https://script.google.com/macros/s/XXXXXX/exec`).
8. Mở file [index.html](file:///Users/ngotanthong/Dự án VibeCode/ChonSoDigiShop/index.html) trong dự án của anh, tìm dòng cấu hình đầu thẻ script `const GAS_API_URL = '';` và dán đường dẫn này vào giữa hai dấu nháy đơn!

---

## 🎯 Cách gỡ liên kết thiết bị (Khi nhân viên đổi máy)
1. Mở Trang tính Google Sheet của anh lên.
2. Tìm dòng của nhân viên cần đặt lại thiết bị.
3. Di chuyển chuột tới cột **Device ID (Cột B)** và **nhấn phím Delete để xoá trắng ô đó**.
4. Xong! Lần tiếp theo nhân viên đó đăng nhập ở máy mới, máy mới đó sẽ tự động được khóa cố định.
5. *Để khóa vĩnh viễn tài khoản:* Anh gõ chữ `Locked` vào cột **Status (Cột E)** của tài khoản đó.
