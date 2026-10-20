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

// Account trong danh sách này được coi như admin:
//   - Xem được số đã ghim của TẤT CẢ mọi người (không chỉ của mình)
//   - Bỏ ghim được số của mọi người
var ADMIN_USERS = ["admin", "thong"];

function isAdminUser_(u) {
  return ADMIN_USERS.indexOf(String(u || "").trim().toLowerCase()) !== -1;
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
      var isAdmin = isAdminUser_(user);
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
      var isAdmin = isAdminUser_(user);
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
          } catch (ex) {
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
