// tests/gas-permissions.test.js
// Khóa lại cấu hình phân quyền admin phía Apps Script (project Ghim Sim).
// Mục tiêu: account trong ADMIN_USERS phải thấy & bỏ ghim được số của mọi người.

var IS_NODE = (function () { try { return !!require('fs'); } catch (e) { return false; } })();

function readRepoFile(name) {
    if (IS_NODE) {
        var fs = require('fs');
        var path = require('path');
        return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    }
    if (typeof readFile === 'function') return readFile(name);
    throw new Error('Không đọc được ' + name + ' (cần node hoặc jsc).');
}

function log(s) {
    if (typeof print === 'function') print(s);
    else console.log(s);
}

var stats = { pass: 0, fail: 0 };
var failures = [];

function ok(desc, cond) {
    if (cond) stats.pass++;
    else { stats.fail++; failures.push(desc); }
}

var gas = readRepoFile('apps-script/PinSim_LogFeedback.gs');
var legacy = readRepoFile('apps-script/PinSim.gs');

// 1. Có danh sách admin + helper
ok('GAS: có hằng ADMIN_USERS', /var ADMIN_USERS = \[/.test(gas));
ok('GAS: có helper isAdminUser_', /function isAdminUser_\(/.test(gas));
ok('GAS: ADMIN_USERS có "admin"', /var ADMIN_USERS = \[[^\]]*"admin"/.test(gas));
ok('GAS: ADMIN_USERS có "thong"', /var ADMIN_USERS = \[[^\]]*"thong"/.test(gas));

// 2. Không còn so sánh cứng chỉ với "admin" (dễ bỏ sót account khác)
ok('GAS: không còn isAdmin = (user === "admin")', gas.indexOf('var isAdmin = (user.toLowerCase() === "admin")') === -1);

// 3. Cả 2 chỗ (unpin + get_pinned) đều dùng helper
var usesHelper = (gas.match(/var isAdmin = isAdminUser_\(user\);/g) || []).length;
ok('GAS: cả unpin và get_pinned dùng isAdminUser_ (2 chỗ)', usesHelper === 2);

// 4. File PinSim.gs (bản cũ) cũng phải định nghĩa helper để không lỗi ReferenceError
ok('PinSim.gs: có helper isAdminUser_', /function isAdminUser_\(/.test(legacy));
ok('PinSim.gs: có ADMIN_USERS', /var ADMIN_USERS = \[/.test(legacy));
ok('PinSim.gs: không còn so sánh cứng "admin"', legacy.indexOf('var isAdmin = (user.toLowerCase() === "admin")') === -1);

// 5. Client không tự chặn quyền admin (quyền nằm ở server)
var sodep = readRepoFile('sodep.html');
var index = readRepoFile('index.html');
ok('sodep.html: không hard-code quyền admin ở client', sodep.indexOf("=== 'admin'") === -1);
ok('index.html: không hard-code quyền admin ở client', index.indexOf("=== 'admin'") === -1);

log('');
if (stats.fail === 0) {
    log('ALL PASSED  (gas-permissions: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
