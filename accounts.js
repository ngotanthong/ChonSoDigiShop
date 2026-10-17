// accounts.js - Danh sách tài khoản được phép truy cập kho SIM VNPT DigiShop
// Để thêm tài khoản mới, hãy mở trang taotailoan.html trên trình duyệt để sinh mã cấu hình và dán vào đây!
//
// LƯU Ý BẢO MẬT:
// - KHÔNG ghi mật khẩu dạng chữ vào file này (không để lại comment mật khẩu).
// - Nên dùng mật khẩu mạnh (>= 12 ký tự, có chữ hoa/thường/số/ký tự đặc biệt);
//   tránh các mật khẩu quá đơn giản như "1", "123456", "vnpt2026".

window.MULTI_DEVICE_USERS = [
    "admin", // Thêm tên đăng nhập VIP vào đây để cho phép đăng nhập nhiều thiết bị
    "doantrungduc",
    "thong",
];

window.ALLOWED_USERS = {
    // "tên_đăng_nhập": "mã_băm_sha256_mật_khẩu"
    "thong": "89aa1e580023722db67646e8149eb246c748e180e34a1cf679ab0b41a416d904", // mật khẩu: 121
    "admin": "0883fb27fe5c0a7721a78a406a86d4296b117d0e6527a6b5347996936526de92",
    "nhanvien1": "0883fb27fe5c0a7721a78a406a86d4296b117d0e6527a6b5347996936526de92",
    "doantrungduc": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    "iphone5": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    "iphonese": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    "win": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    "mac": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
};
