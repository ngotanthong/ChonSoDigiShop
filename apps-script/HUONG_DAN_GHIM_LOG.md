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
