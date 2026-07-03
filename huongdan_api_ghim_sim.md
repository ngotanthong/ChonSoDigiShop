# Hướng Dẫn Cài Đặt API Riêng Cho Chức Năng Ghim Sim

Để tách riêng phần xử lý Ghim Sim ra khỏi hệ thống Đăng Nhập/Kiểm Tra (nhằm quản lý dễ hơn và giảm tải), anh thực hiện theo các bước sau:

## 1. Tạo Google Sheet Mới Cho Ghim Sim
1. Truy cập [Google Sheets](https://docs.google.com/spreadsheets/).
2. Tạo một bảng tính mới, đặt tên là **Data Ghim Sim** (hoặc tên tùy ý).
3. (Tuỳ chọn) Tạo một trang tính (tab) bên trong và đổi tên thành **PinnedSIMs**. (Nếu không tạo, mã sẽ tự động tạo giúp anh).

## 2. Thêm Mã Google Apps Script
1. Tại file Google Sheet vừa tạo, chọn **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
2. Xoá sạch mã cũ trong file `Mã.gs` và dán đoạn mã dưới đây vào:

```javascript
// ==========================================
// CẤU HÌNH BOT TELEGRAM (BỎ TRỐNG NẾU KHÔNG DÙNG)
// ==========================================
var PIN_TELEGRAM_BOT_TOKEN = "8985605068:AAHWSdxaHnGgJ9H41YFToGzgSxAJk90vIQs"; 
var PIN_TELEGRAM_CHAT_ID = "7007784178";

function sendPinTelegramMessage(text) {
  if (!PIN_TELEGRAM_BOT_TOKEN || !PIN_TELEGRAM_CHAT_ID || PIN_TELEGRAM_BOT_TOKEN === "ĐIỀN_TOKEN_BOT_VÀO_ĐÂY") return;
  var url = "https://api.telegram.org/bot" + PIN_TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = {
    "chat_id": PIN_TELEGRAM_CHAT_ID,
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
  function makeResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var action = e.parameter.action;
    var user = e.parameter.user;
    
    if (!user) {
      return makeResponse({ status: "error", message: "Missing user" });
    }

    // ---- PINNED SIMs actions ----
    if (action === "pin") {
      var phone = e.parameter.phone;
      var simData = e.parameter.simData || "";
      var pinSheet = getPinnedSheet();
      var pData = pinSheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < pData.length; i++) {
        var sheetPhone = pData[i][1].toString().trim();
        if (!sheetPhone.startsWith("0")) sheetPhone = "0" + sheetPhone;
        if (pData[i][0].toString().toLowerCase() === user.toLowerCase() && sheetPhone === phone.trim()) {
          found = true;
          pinSheet.getRange(i + 1, 3).setValue(simData);
          pinSheet.getRange(i + 1, 4).setValue(new Date());
          break;
        }
      }
      if (!found) {
        pinSheet.appendRow([user, "'" + phone, simData, new Date()]);
        SpreadsheetApp.flush();
        sendPinTelegramMessage("📌 <b>TEST GHIM SỐ:</b>\n👤 User: <code>" + user + "</code>\n📱 Số: " + phone + "\nĐã lưu thành công vào Sheet!");
      } else {
        SpreadsheetApp.flush();
      }
      return makeResponse({ status: "ok" });
    }

    if (action === "unpin") {
      var phone = e.parameter.phone;
      var pinSheet = getPinnedSheet();
      var pData = pinSheet.getDataRange().getValues();
      var isAdmin = (user.toLowerCase() === "admin");
      for (var i = pData.length - 1; i >= 1; i--) {
        var sheetPhone = pData[i][1].toString().trim();
        if (!sheetPhone.startsWith("0")) sheetPhone = "0" + sheetPhone;
        if ((isAdmin || pData[i][0].toString().toLowerCase() === user.toLowerCase()) && sheetPhone === phone.trim()) {
          pinSheet.deleteRow(i + 1);
        }
      }
      SpreadsheetApp.flush();
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

    return makeResponse({ status: "error", message: "Invalid action received: " + String(action) });

  } catch (err) {
    return makeResponse({ status: "error", message: "Lỗi Server: " + err.message, stack: err.stack });
  }
}

function doPost(e) {
  return doGet(e);
}
```

## 3. Lấy Link API (Deploy)
1. Bấm nút **Triển khai (Deploy)** góc trên cùng bên phải -> Chọn **Tùy chọn triển khai mới (New deployment)**.
2. Ở ô **Chọn loại (Select type)**, chọn biểu tượng bánh răng ⚙️ và tick vào **Ứng dụng web (Web app)**.
3. Phần **Quyền truy cập (Who has access)** chọn **Bất kỳ ai (Anyone)**.
4. Nhấn **Triển khai (Deploy)**. Nếu yêu cầu uỷ quyền, nhấn **Authorize access** và cấp quyền cho phép chạy.
5. Sao chép cái đường dẫn URL được tạo ra (bắt đầu bằng `https://script.google.com/macros/.../exec`).

## 4. Cấu Hình Vào Website
Mở trang website của anh, gọi chức năng "Đổi API" (tuỳ chỉnh), anh sẽ thấy hệ thống bây giờ có hai ô nhập liệu thay vì một:
- **Ô 1**: Nhập đường dẫn Google Apps Script mặc định (dành cho đăng nhập, kiểm tra thiết bị).
- **Ô 2: Nhập đường dẫn Google Apps Script riêng cho tính năng Ghim Sim.**

Dán URL vừa copy ở bước 3 vào **Ô thứ 2** và bấm Lưu!

---

*(Lưu ý: Đoạn mã trên đã bao gồm tính năng lưu dữ liệu an toàn qua phương thức POST và lệnh `SpreadsheetApp.flush()` để ép dữ liệu ghi ngay tức thì trước khi báo qua Telegram).*
