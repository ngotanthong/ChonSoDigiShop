// tests/filters.test.js
// Test "đấu dây" (wiring) cho các bộ lọc giá — đảm bảo nút/option mới
// "Từ 100k trở lên" tồn tại và được xử lý ở cả index.html và sodep.html.
//
// Cách chạy:
//   bash tests/run.sh

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

var index = readRepoFile('index.html');
var sodep = readRepoFile('sodep.html');

// ===========================================================================
// 1. index.html (Tìm Thủ Công) — nút lọc giá "Từ 100k ↑"
// ===========================================================================
ok('index: có nút lọc giá "Từ 100k ↑"', index.indexOf("id: '>=100000'") !== -1);
ok('index: applySort xử lý giá >= 100k', index.indexOf("priorityPrice === '>=100000'") !== -1);
ok('index: nút chỉ hiện khi có giá >= 100k', />=100000'\) return Array\.from\(availablePrices\)\.some\(p => p >= 100000\)/.test(index));

// ===========================================================================
// 2. sodep.html tab Quét — lọc "Cam kết: Từ 100k ↑"
// ===========================================================================
ok('sodep: select Cam kết có option "Từ 100k ↑"', sodep.indexOf('value="gte100000"') !== -1);
ok('sodep: renderResults xử lý cam kết >= 100k', sodep.indexOf("currentCommitment === 'gte100000'") !== -1);

// ===========================================================================
// 3. sodep.html tab Phong Thủy — lọc giá "Từ 100k trở lên"
// ===========================================================================
ok('sodep: select Giá/tháng có option "Từ 100k trở lên"', sodep.indexOf('value="gte100"') !== -1);
ok('sodep: getCustomerMatchingItems xử lý giá >= 100k', sodep.indexOf("customerFilterPrice === 'gte100'") !== -1);
// "Dưới 100k" phải là < 100k để không trùng với "Từ 100k trở lên"
ok('sodep: "Dưới 100k" KHÔNG bao gồm đúng 100k',
    sodep.indexOf("customerFilterPrice === 'low') return monthly > 0 && monthly < 100000;") !== -1);

// ===========================================================================
// 4. Lọc 0đ: trả trước / trả sau / cả 2 loại
//    (trả trước = cước 0đ + không cam kết; trả sau = cước 0đ + cam kết > 0)
// ===========================================================================
ok('index: có nút "0đ (cả 2 loại)"', index.indexOf("label: '0đ (cả 2 loại)'") !== -1);
ok('index: có nút "0đ trả trước"', index.indexOf("id: '0pre'") !== -1);
ok('index: có nút "0đ trả sau"', index.indexOf("id: '0post'") !== -1);
ok('index: có helper isTraTruocSim + isTraSauSim',
    /function isTraTruocSim\(/.test(index) && /function isTraSauSim\(/.test(index));
ok('index: applySort lọc "0đ trả trước"', index.indexOf("priorityPrice === '0pre'") !== -1);
ok('index: applySort lọc "0đ trả sau"', index.indexOf("priorityPrice === '0post'") !== -1);
ok('index: nút 0đ trả trước/sau chỉ hiện khi có số 0đ',
    /opt\.id === '0pre' \|\| opt\.id === '0post'\) return availablePrices\.has\(0\)/.test(index));

ok('sodep: Cam kết có option "0đ trả trước"', sodep.indexOf('value="zero_pre"') !== -1);
ok('sodep: Cam kết có option "0đ trả sau"', sodep.indexOf('value="zero_post"') !== -1);
ok('sodep: renderResults lọc "0đ trả trước"', sodep.indexOf("currentCommitment === 'zero_pre'") !== -1);
ok('sodep: renderResults lọc "0đ trả sau"', sodep.indexOf("currentCommitment === 'zero_post'") !== -1);
ok('sodep: Phong Thủy lọc "0đ trả trước"', sodep.indexOf("customerFilterPrice === 'zero_pre'") !== -1);
ok('sodep: Phong Thủy lọc "0đ trả sau"', sodep.indexOf("customerFilterPrice === 'zero_post'") !== -1);

// ===========================================================================
// Tổng kết
// ===========================================================================
log('');
if (stats.fail === 0) {
    log('ALL PASSED  (filters: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
