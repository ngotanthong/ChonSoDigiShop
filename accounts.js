// accounts.js - Danh sách tài khoản được phép truy cập kho SIM VNPT DigiShop
// Để thêm tài khoản mới, hãy mở trang taotailoan.html trên trình duyệt để sinh mã cấu hình và dán vào đây!

window.MULTI_DEVICE_USERS = [
    "admin", // Thêm tên đăng nhập VIP vào đây để cho phép đăng nhập nhiều thiết bị
    "doantrungduc",
];

window.ALLOWED_USERS = {
    // "tên_đăng_nhập": "mã_băm_sha256_mật_khẩu"
    "admin": "0883fb27fe5c0a7721a78a406a86d4296b117d0e6527a6b5347996936526de92", // mật khẩu: vnpt2026
    "nhanvien1": "0883fb27fe5c0a7721a78a406a86d4296b117d0e6527a6b5347996936526de92", // mật khẩu: vnpt2026
    "doantrungduc": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // mật khẩu: 123456
    "iphone5": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // mật khẩu: 1
    "iphonese": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // mật khẩu: 1
    "win": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // mật khẩu: 1
    "mac": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // mật khẩu: 1



};
