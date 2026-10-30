// tests/check-kho.test.js
// Kiểm tra logic kiểm tra tồn kho (apps-script/CheckKho.gs) — chạy offline,
// giả lập UrlFetchApp để không gọi API thật.
//
// Mục tiêu: khoá lại 4 lỗi khiến bản cũ báo sai:
//   1. Gửi nguyên số 10 chữ số vào ?search= (API chỉ nhận 7 số cuối)
//   2. Chỉ kiểm tra commit=0 (số cam kết 100k/200k/600k bị coi là đã bán)
//   3. Kết luận theo data.length thay vì so khớp chính xác
//   4. Coi lỗi API là "đã bán" (phải là "không kiểm tra được")
//
// Cách chạy: bash tests/run.sh

var IS_NODE = (function () { try { return !!require('fs'); } catch (e) { return false; } })();

function readRepoFile(name) {
    if (IS_NODE) {
        var fs = require('fs');
        var path = require('path');
        return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    }
    if (typeof readFile === 'function') return readFile(name);
    throw new Error('Không đọc được ' + name);
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

var src = readRepoFile('apps-script/CheckKho.gs');
var G = (typeof global !== 'undefined') ? global : this;

// --- Giả lập môi trường Apps Script ---
var fetchLog = [];
var apiByCommit = {};   // commit -> { errorCode, data } hoặc 'HTTP500'
var cacheStore = {};
var pingRows = [{ so_tb: '84911068203' }]; // dữ liệu cho query kiểm tra API sống

G.UrlFetchApp = {
    fetch: function (url) {
        fetchLog.push(url);
        // Query kiểm tra API sống: ?search=*68*
        if (url.indexOf('search=*68*') !== -1) {
            if (apiByCommit.__ping === 'HTTP500') {
                return { getResponseCode: function () { return 500; }, getContentText: function () { return 'loi'; } };
            }
            return {
                getResponseCode: function () { return 200; },
                getContentText: function () { return JSON.stringify({ errorCode: 0, data: pingRows }); }
            };
        }
        var m = /[?&]commit=([0-9]+)/.exec(url);
        var commit = m ? m[1] : '';
        var resp = apiByCommit[commit];
        if (resp === 'HTTP500') {
            return { getResponseCode: function () { return 500; }, getContentText: function () { return 'loi'; } };
        }
        if (!resp) resp = { errorCode: -1, data: [] };
        return {
            getResponseCode: function () { return 200; },
            getContentText: function () { return JSON.stringify(resp); }
        };
    }
};

G.CacheService = {
    getScriptCache: function () {
        return {
            get: function (k) { return cacheStore[k] || null; },
            put: function (k, v) { cacheStore[k] = String(v); }
        };
    }
};

G.Utilities = { sleep: function () {} };

G.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: function (t) {
        return { text: t, setMimeType: function () { return this; } };
    }
};

G.SpreadsheetApp = {
    getActiveSpreadsheet: function () { return null; },
    getUi: function () { return {}; }
};

// Nạp file GAS vào phạm vi toàn cục
(0, eval)(src);

function apiRows(nums) {
    return nums.map(function (n) {
        return {
            so_tb: '84' + String(n).slice(1),
            monthly: '0', commitment: '6', price: 33500, stock: '146', status: '1',
            kieuso_name: 'Kiểu test <br>(abc)'
        };
    });
}

function reset(byCommit) {
    fetchLog = [];
    cacheStore = {};
    apiByCommit = byCommit || {};
    // API sống mặc định; test nào cần "API chết" thì set apiByCommit.__ping = 'HTTP500'
    if (apiByCommit.__ping === undefined) apiByCommit.__ping = 'ok';
    if (typeof CK_ALIVE_CACHE !== 'undefined') CK_ALIVE_CACHE = null;
}

// ---------------- 1. Chuẩn hoá số ----------------
ok('normalize: 84... -> 0...', ckNormalizePhone_('84911388842') === '0911388842');
ok('normalize: 0084... -> 0...', ckNormalizePhone_('0084911388842') === '0911388842');
ok('normalize: 9 số -> thêm 0', ckNormalizePhone_('911388842') === '0911388842');
ok('normalize: có dấu cách/chấm', ckNormalizePhone_('0911 388.842') === '0911388842');
ok('normalize: rỗng', ckNormalizePhone_('') === '');

// ---------------- 2. Tham số API ----------------
var q = ckBuildQuery_('0911388842');
ok('query: search = 7 số cuối', q && q.search === '1388842');
ok('query: prefix = 84 + 2 số đầu', q && q.prefix === '8491');
ok('query: số sai trả null', ckBuildQuery_('12345') === null);

reset();
checkSoTrongKho_('0911388842', { boQuaCache: true });
var url0 = fetchLog[0] || '';
ok('URL không chứa nguyên số 10 chữ số', url0.indexOf('0911388842') === -1);
ok('URL có search=7 số cuối', /[?&]search=1388842(&|$)/.test(url0));
ok('URL có prefix=8491', /[?&]prefix=8491(&|$)/.test(url0));
ok('URL có commit', /[?&]commit=0(&|$)/.test(url0));

// ---------------- 3. Chỉ tìm thấy đúng số ở commit 600k ----------------
reset({
    '0': { errorCode: 0, data: apiRows(['0911388842'].slice(0, 0)) },
    '100000': { errorCode: 0, data: [] },
    '200000': { errorCode: 0, data: [] },
    '600000': { errorCode: 0, data: [{
        so_tb: '84911388842', monthly: '600000', commitment: '18',
        price: 33500, stock: '146', status: '1', kieuso_name: 'A68.B68 <br> x'
    }] }
});
var r600 = checkSoTrongKho_('0911388842');
ok('số cam kết 600k vẫn báo CÒN HÀNG', r600.conHang === true);
ok('trả đúng monthly 600000', r600.monthly === 600000);
ok('trả đúng commit tìm thấy', r600.commitDaTimThay === 600000);
ok('làm sạch <br> trong kiểu số', r600.kieuso === 'A68.B68 x');
ok('đã thử nhiều mức commit', fetchLog.length >= 2);

// ---------------- 4. Không có trong bất kỳ mức nào -> đã bán ----------------
reset({
    '0': { errorCode: 0, data: apiRows(['0912345678']) },
    '100000': { errorCode: 0, data: [] },
    '200000': { errorCode: 0, data: [] },
    '600000': { errorCode: 0, data: [] }
});
var rSold = checkSoTrongKho_('0911388842');
ok('không khớp số nào -> conHang false', rSold.conHang === false);
ok('trạng thái đã bán', /Đã bán/.test(rSold.trangThai));

// ---------------- 5. Có dòng cùng đuôi nhưng KHÁC số -> không được báo còn ----------------
reset({
    '0': { errorCode: 0, data: apiRows(['0911388843', '0911388844']) },
    '100000': { errorCode: 0, data: [] },
    '200000': { errorCode: 0, data: [] },
    '600000': { errorCode: 0, data: [] }
});
ok('cùng 7 số cuối nhưng khác số -> đã bán', checkSoTrongKho_('0911388842').conHang === false);

// ---------------- 6. Lỗi API -> "không kiểm tra được", KHÔNG phải đã bán ----------------
reset({
    '0': 'HTTP500',
    '100000': 'HTTP500',
    '200000': 'HTTP500',
    '600000': 'HTTP500',
    __ping: 'HTTP500'
});
var rErr = checkSoTrongKho_('0911388842');
ok('lỗi API -> conHang null', rErr.conHang === null);
ok('lỗi API -> "Không kiểm tra được"', rErr.trangThai === 'Không kiểm tra được');
ok('lỗi API -> có ghi lỗi', !!rErr.loi);

// errorCode -1 của VNPT = "không có kết quả" (không phải lỗi server)
reset({
    '0': { errorCode: -1, data: [] },
    '100000': { errorCode: -1, data: [] },
    '200000': { errorCode: -1, data: [] },
    '600000': { errorCode: -1, data: [] }
});
ok('errorCode -1 (không có kết quả) -> đã bán', checkSoTrongKho_('0911388842').conHang === false);

// ---------------- 7. Số không hợp lệ ----------------
ok('số không hợp lệ -> conHang null', checkSoTrongKho_('123').conHang === null);
ok('số không hợp lệ -> báo rõ', /không hợp lệ/i.test(checkSoTrongKho_('123').trangThai));

// ---------------- 8. Cache ----------------
reset({ '0': { errorCode: 0, data: apiRows(['0911388842']) } });
var c1 = checkSoTrongKho_('0911388842');
var fetchAfter1 = fetchLog.length;
var c2 = checkSoTrongKho_('0911388842');
ok('cache: lần 2 không gọi lại API', fetchLog.length === fetchAfter1);
ok('cache: kết quả giống nhau', c1.conHang === c2.conHang && c1.so === c2.so);
checkSoTrongKho_('0911388842', { boQuaCache: true });
ok('boQuaCache: gọi lại API', fetchLog.length > fetchAfter1);

// Xoá cache = tăng version -> key mới
var verBefore = ckCacheVersion_();
var keyBefore = ckCacheKey_('0911388842');
ckClearCache_();
ok('xoá cache: version tăng', Number(ckCacheVersion_()) === Number(verBefore) + 1);
ok('xoá cache: key đổi', ckCacheKey_('0911388842') !== keyBefore);

// ---------------- 9. Web App doGet ----------------
reset({ '0': { errorCode: 0, data: apiRows(['0911388842']) } });
var res1 = JSON.parse(doGet({ parameter: { action: 'check', phone: '0911388842' } }).text);
ok('doGet 1 số: status ok', res1.status === 'ok');
ok('doGet 1 số: có data[]', res1.count === 1 && res1.data.length === 1);
ok('doGet 1 số: đưa kết quả ra ngoài', res1.so === '0911388842' && res1.conHang === true);

reset({ '0': { errorCode: 0, data: [] } });
var res2 = JSON.parse(doGet({ parameter: { action: 'check', phones: '0912345678, 0987654321' } }).text);
ok('doGet nhiều số: count = 2', res2.count === 2);

var res3 = JSON.parse(doGet({ parameter: { action: 'check' } }).text);
ok('doGet thiếu số: báo lỗi', res3.status === 'error');

var res4 = JSON.parse(doGet({ parameter: { action: 'ping' } }).text);
ok('doGet ping: ok + commits', res4.status === 'ok' && res4.commits.length >= 2);

var res5 = JSON.parse(doGet({ parameter: { action: 'abc' } }).text);
ok('doGet action lạ: báo lỗi', res5.status === 'error');

// ---------------- 10. Parse tham số ----------------
ok('parse commits: "0,100000"', ckParseCommits_('0,100000').join(',') === '0,100000');
ok('parse commits: rỗng -> null', ckParseCommits_('') === null);
ok('parse phones: bỏ trùng', ckParsePhones_({ phones: '0912345678,84912345678' }).length === 1);

// ---------------- 11. File có menu/entry đúng ----------------
ok('có onOpen cho menu Sheet', /function onOpen\(/.test(src));
ok('có hàm check theo Sheet', /function ckCheckSheet_\(/.test(src));
ok('có doGet cho Web App', /function doGet\(e\)/.test(src));

log('');
if (stats.fail === 0) {
    log('ALL PASSED  (check-kho: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
