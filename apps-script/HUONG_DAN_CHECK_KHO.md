# Hướng Dẫn: Check Tồn Kho SIM (Apps Script)

File code: [`apps-script/CheckKho.gs`](CheckKho.gs) — kiểm tra 1 số / nhiều số / cả tab Sheet
xem **còn hàng** hay **đã bán**, dựa trên API công khai của VNPT DigiShop.

Mục đích chính: thay bản check cũ hay **báo sai** (báo "đã bán" cho số vẫn còn, hoặc
ngược lại) bằng bản đã xử lý đúng các đặc thù của API.

---

## Vì sao bản cũ báo sai?

### 1. Gửi nguyên số 10 chữ số vào `search`

API **chỉ nhận 7 số cuối**. Gửi `0912345678` hay `84912345678` → API trả 0 dòng →
bản cũ kết luận "đã bán" dù số đang bán.

Cách đúng:

```
số:     0912 345 678
prefix: 84 + 2 số đầu sau số 0  -> 8491
search: 7 số cuối               -> 2345678
```

### 2. Chỉ kiểm tra `commit=0`

Mỗi số chỉ xuất hiện ở **đúng mức cam kết** của nó. Số bán kèm cam kết 100k/200k/600k
**không bao giờ** nằm trong kết quả `commit=0`, nên bản cũ báo "đã bán" oan.

Các mức API thực tế đang trả dữ liệu (kiểm tra 10/2026): `0`, `100000`, `200000`, `600000`
(hằng `CK_COMMIT_VALUES`). Nếu VNPT thêm mức mới, số ở mức đó sẽ bị bỏ sót → cập nhật mảng này.

> Ví dụ thật: `0919396896` chỉ xuất hiện ở `commit=600000`. Check `commit=0` → 0 dòng.

### 3. Dùng `data.length` thay vì so khớp chính xác

`search` là 7 số cuối nên kết quả trả về **mọi số có cùng đuôi**. `data.length > 0`
không có nghĩa là đúng số mình cần. Bản mới so khớp từng dòng (`ckFindExact_`) sau khi
chuẩn hoá `84...` → `0...`.

### 4. Coi lỗi API là "đã bán"

Timeout / HTTP 500 / JSON hỏng mà kết luận "đã bán" là sai. Bản mới trả
`conHang: null` + `"Không kiểm tra được"`.

Lưu ý: VNPT trả `errorCode: -1` khi **không có kết quả**, không phải lỗi server → được
coi là "0 dòng". Khi không tìm thấy số ở mọi mức cam kết, script gọi 1 query kiểm tra API
còn sống (`*68*`); nếu API chết thì trả "không kiểm tra được" thay vì "đã bán".

---

## Cài đặt (khuyến nghị: project RIÊNG)

> ⚠️ Nên tạo **project Apps Script riêng** cho CheckKho. Nếu dán chung project Ghim
> (`PinSim_LogFeedback.gs`), hai file sẽ **tranh nhau hàm `doGet`** và Web App sẽ chạy
> sai. Nếu buộc phải dùng chung, xem mục "Dùng chung project" bên dưới.

1. Tạo Google Sheet mới (hoặc mở Sheet đang dùng) → **Tiện ích mở rộng → Apps Script**.
2. Xoá code mẫu, dán **toàn bộ** [`apps-script/CheckKho.gs`](CheckKho.gs).
3. **Lưu** (`Cmd + S`).
4. **Deploy → Tuỳ chọn triển khai mới (New deployment) → Ứng dụng web (Web app)**:
   - *Thực thi dưới dạng*: **Tôi (Me)**
   - *Ai có quyền truy cập*: **Bất kỳ ai (Anyone)** — tool gọi không cần đăng nhập Google
   - Bấm **Deploy**, cấp quyền, copy link `/exec`.
5. Mở link vừa copy + `?action=ping` để kiểm tra:

```bash
curl "https://script.google.com/macros/s/XXXX/exec?action=ping"
# {"status":"ok","service":"checkkho","commits":[0,100000,200000,600000],...}
```

Mỗi lần sửa code phải **Deploy → Quản lý bản triển khai → ✏️ → Phiên bản mới → Deploy**
(chỉ Lưu là chưa đủ). Sau khi deploy, nhớ **hard-reload** tool (`Cmd + Shift + R`).

---

## Dùng qua Web App (URL)

### 1 số

```bash
curl "https://.../exec?action=check&phone=0919396896"
```

Kết quả:

```json
{
  "status": "ok",
  "count": 1,
  "so": "0919396896",
  "conHang": true,
  "trangThai": "Còn hàng",
  "commitDaTimThay": 600000,
  "monthly": 600000,
  "commitment": "18",
  "price": 33500,
  "stock": "146",
  "kieuso": "10 số A39.B39|...",
  "checkedAt": "2026-10-30T...",
  "data": [ { "...": "giống trên" } ]
}
```

### Nhiều số (tối đa 20/lần, mỗi số tốn 1–4 request)

```bash
curl "https://.../exec?action=check&phones=0912345678,0987654321"
```

### Kiểm tra cả tab `CHECKKHO` và ghi kết quả lại

```bash
curl "https://.../exec?action=check_all"
# có thể giới hạn: &limit=50
```

### Chẩn đoán

```bash
curl "https://.../exec?action=diag&phone=0919396896"
```

Trả về từng mức cam kết có bao nhiêu dòng + `apiAlive` — dùng khi nghi API đổi
hoặc cần biết mức cam kết mới.

### Ý nghĩa `conHang`

| `conHang` | Nghĩa | Việc cần làm |
|---|---|---|
| `true` | Còn hàng (kèm giá/cam kết/kho) | Báo khách |
| `false` | Đã bán / không còn ở mọi mức cam kết | Ẩn số |
| `null` | Không kiểm tra được (sai số / API lỗi / mất mạng) | Thử lại, **đừng** coi là đã bán |

### Gọi từ JavaScript (tool/website)

```js
async function checkKho(phone) {
  const url = `${CHECK_KHO_API}?action=check&phone=${encodeURIComponent(phone)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message);
  return json; // json.conHang: true / false / null
}
```

---

## Dùng trong Google Sheet (menu)

1. Mở file Sheet chứa project này → tải lại trang → có menu **📦 Check kho SIM**.
2. Chọn **Tạo tab CHECKKHO** → dán danh sách số vào **cột A** (mỗi dòng 1 số).
3. Chọn **Kiểm tra cả tab CHECKKHO**:
   - Ghi vào cột B–H: `Còn hàng · Trạng thái · Giá/tháng · Cam kết · Kho · Kiểu số · Kiểm tra lúc`
   - Mỗi lần chạy tối đa `CK_MAX_ROWS_PER_RUN = 80` số (tránh giới hạn 6 phút).
     Còn dư thì chạy lại menu, script báo "Còn lại chưa kiểm tra: N".
4. **Kiểm tra 1 số…** để check nhanh không cần ghi Sheet.

Kết quả được **cache 5 phút** (`CK_CACHE_SECONDS`). Muốn check lại ngay:
menu **Xoá cache kết quả**, hoặc gọi Web App với `&commits=...` khác.

---

## Dùng chung project với Ghim (không khuyến nghị)

Nếu bắt buộc dán chung `CheckKho.gs` + `PinSim_LogFeedback.gs` trong 1 project:

1. Trong `CheckKho.gs`, đổi tên `function doGet(e)` thành `function doGetCheckKho(e)`.
2. Trong `PinSim_LogFeedback.gs`, thêm nhánh chuyển tiếp ngay đầu `doGet`:

```js
if (String(e.parameter.action || "").indexOf("checkkho_") === 0) {
  e.parameter.action = String(e.parameter.action).replace("checkkho_", "");
  return doGetCheckKho(e);
}
```

3. Gọi bằng `?action=checkkho_check&phone=...` để không đụng `action` của Ghim.

Cách này dễ nhầm — vẫn khuyến nghị **project riêng**.

---

## Giới hạn & lưu ý

- **Quota Apps Script**: `UrlFetchApp` ~20.000 request/ngày (tài khoản thường).
  Mỗi số cần 1–4 request (tuỳ mức cam kết) → đừng check lại danh sách quá thường xuyên;
  cache 5 phút đã giúp giảm mạnh.
- API là API công khai của VNPT DigiShop, có thể đổi tham số/định dạng bất cứ lúc nào.
  Nếu kết quả bất thường, chạy `?action=diag` trước.
- Số phải là **10 chữ số** dạng `0xxxxxxxxx`; script tự chuẩn hoá `84...`, `0084...`, số 9 chữ số.
- `prefix` phải là `84` + **đúng 2 số** đầu sau số 0; sai prefix API trả lỗi.
- Chỉ kết luận "đã bán" khi API trả lời được và **không** có dòng nào khớp chính xác.

---

## Kiểm tra tự động

```bash
bash tests/run.sh
```

Bộ `tests/check-kho.test.js` (44 kiểm tra) giả lập `UrlFetchApp` và khoá lại đúng 4 lỗi
ở trên: URL đúng 7 số cuối, thử nhiều mức cam kết, so khớp chính xác, lỗi API ≠ đã bán.
