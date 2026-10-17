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
  // CORS header helper
  function makeResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var action = e.parameter.action;
    var user = e.parameter.user;
    var deviceId = e.parameter.deviceId;
    var userAgent = e.parameter.userAgent || "";

    // === GHI LOG FEEDBACK (copy / ghim / in / phân tích...) vào tab "FeedbackLog" ===
    if (action === "log_feedback") {
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var logSheet = ss.getSheetByName("FeedbackLog");
        if (!logSheet) {
          logSheet = ss.insertSheet("FeedbackLog");
          logSheet.appendRow(["Thời gian", "User", "Hành động", "Số", "Điểm", "Thông tin thêm"]);
          logSheet.setFrozenRows(1);
        }
        logSheet.appendRow([
          new Date(),
          e.parameter.user || "",
          e.parameter.type || "",
          "'" + (e.parameter.num || ""),
          e.parameter.score || "",
          e.parameter.extra || ""
        ]);
      } catch (err) {}
      return makeResponse({ status: "ok" });
    }

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

    return makeResponse({ status: "error", message: "Invalid action received: " + String(action) });

  } catch (err) {
    return makeResponse({ status: "error", message: "Lỗi Server: " + err.message, stack: err.stack });
  }
}

function doPost(e) {
  return doGet(e);
}
