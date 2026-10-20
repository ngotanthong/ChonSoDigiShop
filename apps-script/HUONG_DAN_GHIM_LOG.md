# Hướng Dẫn: Khôi Phục Ghim Sim + Ghi Log Feedback (gộp 1 project)

Tình huống: project **Ghim Sim** (link `GAS_PIN_API_URL`,
`AKfycbzuUk3M2D-eIxnBugn30VmUrIUok9qYj28pRlOTK0s_FDrsEknyJ-0ZfwUFBER2j3KVUQ`)
bị dán nhầm code **đăng nhập** vào, nên chức năng Ghim bị lỗi.

Giải pháp: dán **file gộp** `apps-script/PinSim_LogFeedback.gs` — vừa khôi phục Ghim,
vừa ghi được log feedback vào cùng file Google Sheet của project đó.

---

## Các bước làm

1. Mở Google Sheet **"Data Ghim Sim"** → menu **Tiện ích mở rộng (Extensions)** → **Apps Script**.
2. Trong `Mã.gs`, **xóa sạch** toàn bộ code cũ.
3. Copy **toàn bộ** nội dung file [`apps-script/PinSim_LogFeedback.gs`](PinSim_LogFeedback.gs) và dán vào.
4. Bấm **Lưu** (`Cmd + S` / `Ctrl + S`).
5. Cập nhật bản triển khai để giữ nguyên link `/exec`:
   - **Deploy** → **Quản lý các bản triển khai (Manage deployments)**
   - Bấm **bút chì ✏️** ở bản đang chạy → mục **Phiên bản (Version)** chọn **Phiên bản mới (New version)** → **Deploy**.

> ⚠️ Chỉ bấm **Lưu** thôi là **KHÔNG đủ** — phải tạo **Phiên bản mới** thì link `/exec` mới chạy code mới.

---

## Kết quả sau khi deploy

- **Ghim Sim** hoạt động lại (📌 ghim / bỏ ghim / tải danh sách ghim).
- Tab **`FeedbackLog`** tự xuất hiện trong file Sheet "Data Ghim Sim", ghi lại mỗi khi
  nhân viên **copy số / ghim / mở phân tích / in bảng / tải ảnh**.
  Các cột: `Thời gian · User · Hành động · Số · Điểm · Thông tin thêm`.

## Link API (không đổi)

- Link Ghim (đã có trong `sodep.html` / `index.html` dưới tên `GAS_PIN_API_URL`):
  `https://script.google.com/macros/s/AKfycbzuUk3M2D-eIxnBugn30VmUrIUok9qYj28pRlOTK0s_FDrsEknyJ-0ZfwUFBER2j3KVUQ/exec`
- Tool (`sodep.html`) gửi log feedback về **link này**.

## Kiểm tra nhanh

Mở tool, copy 1 số → mở Sheet → tab `FeedbackLog` sẽ có 1 dòng mới.
(Nếu thấy dòng test `User = __ping__`, xóa đi là được.)

---

## Lỗi: "Telegram vẫn báo nhưng không thấy dòng trong Sheet"

### Kiểm tra trước tiên (90% trường hợp là do cái này)

Dòng ghim mới **luôn được thêm ở CUỐI bảng** của tab `PinnedSIMs`
(không chèn lên đầu, không tự sắp xếp).

1. Mở tab `PinnedSIMs`.
2. Bấm **`Cmd + ↓`** (Mac) / **`Ctrl + End`** (Windows) để nhảy xuống dòng cuối.
3. Nếu tab đang bật **bộ lọc (Filter)** hoặc **sắp xếp theo khoảng**, dòng mới
   có thể bị ẩn → menu **Dữ liệu (Data)** → **Tắt bộ lọc**.

### Nếu vẫn không thấy

Nguyên nhân: script đang ghi vào **một file Sheet khác** với file anh đang mở
(hoặc vào tab khác tên). Ghim vẫn lưu thật, chỉ là lưu nhầm file.

### Bước 1 — Xem script đang ghi vào file nào

Mở trình duyệt, dán link sau (thay `<URL_GAS_PIN>` bằng link Ghim ở trên):

```
<URL_GAS_PIN>?action=diag
```

Kết quả trả về dạng:

```json
{
  "status": "ok",
  "spreadsheetName": "Data Ghim Sim",
  "spreadsheetIdTail": "aBcD1234",
  "explicitId": false,
  "tabs": [
    { "name": "PinnedSIMs", "lastRow": 400 },
    { "name": "FeedbackLog", "lastRow": 812 }
  ]
}
```

- `spreadsheetName` / `spreadsheetIdTail`: file thật mà script đang ghi.
- `tabs`: danh sách tab + số dòng cuối của từng tab.
- So `spreadsheetIdTail` với 8 ký tự cuối trong URL file Sheet anh đang mở:
  `.../spreadsheets/d/<ID>/edit` → 8 ký tự cuối của `<ID>`.

Nếu 2 mã **khác nhau** → đúng là ghi nhầm file, làm bước 2.

### Bước 2 — Chỉ định đúng file Sheet

1. Mở file Sheet **đúng** (file anh muốn lưu ghim).
2. Copy ID trên URL: `.../spreadsheets/d/`**`<ID>`**`/edit`.
3. Trong Apps Script, đầu file có dòng:

   ```js
   var SPREADSHEET_ID = "";
   ```

   Dán ID vào giữa 2 dấu ngoặc kép:

   ```js
   var SPREADSHEET_ID = "1AbCdEf...";
   ```

4. **Lưu** → **Deploy** → **Manage deployments** → ✏️ → **New version** → **Deploy**.
5. Gọi lại `?action=diag` để chắc chắn `spreadsheetName` đã là file đúng.
6. Bấm ghim thử 1 số → mở Sheet → tab `PinnedSIMs` sẽ có dòng mới.

> Lưu ý: tài khoản chạy script (chủ project) phải có quyền **Sửa** file Sheet đó.
> Nếu file đúng chưa có tab `PinnedSIMs` / `FeedbackLog`, script sẽ tự tạo.

### Nếu 2 mã giống nhau mà vẫn không thấy dòng

- Kiểm tra tab đang xem có đúng tên **`PinnedSIMs`** không (không phải tab khác).
- Bỏ bộ lọc/sắp xếp đang bật trên tab đó — dòng mới được thêm ở **cuối bảng**,
  nên nếu đang lọc thì có thể bị ẩn.
