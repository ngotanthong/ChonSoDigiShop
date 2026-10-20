// ==========================================
// GHIM SIM + GHI LOG FEEDBACK (1 project)
// ==========================================
var PIN_TELEGRAM_BOT_TOKEN = "8985605068:AAHWSdxaHnGgJ9H41YFToGzgSxAJk90vIQs";
var PIN_TELEGRAM_CHAT_ID = "7007784178";

// ==========================================
// FILE SHEET ĐÍCH
// ==========================================
// Để trống "" = ghi vào file mà project này đang gắn (bound spreadsheet).
// NẾU ghim báo Telegram nhưng không thấy dòng trong file anh mở:
//   -> script đang ghi nhầm file. Dán ID file ĐÚNG vào đây.
//   -> Lấy ID từ URL Sheet: .../spreadsheets/d/<ID_NẰM_Ở_ĐÂY>/edit
var SPREADSHEET_ID = "";

function getSS_() {
  var id = String(SPREADSHEET_ID || "").trim();
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Project chưa gắn với file Sheet nào. Hãy dán ID file đúng vào biến SPREADSHEET_ID.");
  }
  return ss;
}

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
  var ss = getSS_();
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

    // === GHI LOG FEEDBACK (copy / ghim / in / phân tích...) vào tab "FeedbackLog" ===
    if (action === "log_feedback") {
      try {
        var ss = getSS_();
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

    // === CHẨN ĐOÁN: xem script đang ghi vào FILE NÀO / TAB NÀO ===
    // Gọi: <URL>?action=diag
    if (action === "diag") {
      try {
        var dss = getSS_();
        var tabs = dss.getSheets().map(function (s) {
          return { name: s.getName(), lastRow: s.getLastRow() };
        });
        var idStr = dss.getId() || "";
        return makeResponse({
          status: "ok",
          spreadsheetName: dss.getName(),
          spreadsheetIdTail: idStr.slice(-8),
          explicitId: !!String(SPREADSHEET_ID || "").trim(),
          tabs: tabs
        });
      } catch (de) {
        return makeResponse({ status: "error", message: "Diag lỗi: " + de.message });
      }
    }

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
