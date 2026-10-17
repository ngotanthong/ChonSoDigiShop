// tests/ai-scoring.test.js
// Bộ test tự động cho bộ chấm điểm SIM (ai-scoring.js).
//
// Cách chạy:
//   bash tests/run.sh          (khuyến nghị)
//   jsc tests/ai-scoring.test.js
//   node tests/ai-scoring.test.js
//
// Mục đích: mỗi khi sửa rule trong ai-scoring.js, chạy bộ này để tránh làm hỏng
// (hồi quy) những số đã được thống nhất là đẹp/xấu.

// --- Nạp ai-scoring.js vào phạm vi toàn cục ---
(function loadEngine() {
    var fs = null;
    try { fs = require('fs'); } catch (e) { fs = null; }
    if (fs) {
        // Node
        var path = require('path');
        var src = fs.readFileSync(path.join(__dirname, '..', 'ai-scoring.js'), 'utf8');
        (0, eval)(src);
    } else if (typeof load === 'function') {
        // JavaScriptCore (jsc) - chạy từ thư mục gốc repo
        load('ai-scoring.js');
    } else {
        throw new Error('Không tìm thấy cách nạp ai-scoring.js (cần node hoặc jsc).');
    }
})();

function log(s) {
    if (typeof print === 'function') print(s);
    else console.log(s);
}

var stats = { pass: 0, fail: 0 };
var failures = [];

function ok(desc, cond) {
    if (cond) { stats.pass++; }
    else { stats.fail++; failures.push(desc); }
}

function sim(n) { return analyzeSIM(n, 0); }
function score(n) { return sim(n).score; }
function tags(n) { return sim(n).reasonsArr; }
function hasTag(n, t) { return tags(n).indexOf(t) !== -1; }

// ===========================================================================
// 1. Tứ Quý ở đầu/giữa + đuôi lộn xộn => phải bị loại (score < 20)
// ===========================================================================
['0888864082', '0888850241', '0888862157', '0844446215', '0800006215', '0899996215', '0866662157']
    .forEach(function (n) {
        ok('Tứ Quý giữa + đuôi loạn phải bị loại: ' + n + ' (score=' + score(n) + ')', score(n) < 20);
    });

// ===========================================================================
// 2. Tứ Quý ở đầu/giữa + đuôi đẹp => phải giữ điểm
// ===========================================================================
['0888841234', '0888812347', '0888845678', '0822221234', '0899991234']
    .forEach(function (n) {
        ok('Tứ Quý giữa + đuôi đẹp phải giữ điểm: ' + n + ' (score=' + score(n) + ')', score(n) >= 60);
    });

// ===========================================================================
// 3. Tứ Quý ở đuôi => điểm cao
// ===========================================================================
['0812341111', '0812346666', '0812349999', '0812340000']
    .forEach(function (n) {
        ok('Tứ Quý đuôi điểm cao: ' + n + ' (score=' + score(n) + ')', score(n) >= 70);
    });

// ===========================================================================
// 4. Số đẹp kinh điển
// ===========================================================================
['0888888888', '0888868686', '0888686868', '0888866666', '0987777777']
    .forEach(function (n) {
        ok('Số đẹp >= 90: ' + n + ' (score=' + score(n) + ')', score(n) >= 90);
    });

// ===========================================================================
// 5. Đã bỏ rule cộng điểm "Không 4, 7"
// ===========================================================================
['0888666888', '0888888888', '0912345678'].forEach(function (n) {
    ok('Không còn tag "Không 4, 7": ' + n, !hasTag(n, 'Không 4, 7'));
});

// ===========================================================================
// 6. Lặp Xen Kẽ: chỉ tính đuôi + tăng, bỏ giữa + giảm
// ===========================================================================
ok('Lặp Xen Kẽ đuôi TĂNG được tính: 0999626466', hasTag('0999626466', 'Lặp Xen Kẽ'));
ok('Lặp Xen Kẽ đuôi GIẢM không tính: 0999686664', !hasTag('0999686664', 'Lặp Xen Kẽ'));
ok('Lặp Xen Kẽ ở GIỮA không tính: 6264661234', !hasTag('6264661234', 'Lặp Xen Kẽ'));

// ===========================================================================
// 7. Số linh tinh bị loại
// ===========================================================================
['0986031472', '0902468123'].forEach(function (n) {
    ok('Số linh tinh phải bị loại: ' + n + ' (score=' + score(n) + ')', score(n) < 20);
});

// ===========================================================================
// 8. Bất biến: điểm luôn trong 0..100 và chấm điểm có tính lặp lại (deterministic)
// ===========================================================================
['0888888888', '0986031472', '0912345678', '0888864082', '0903184986'].forEach(function (n) {
    var s = score(n);
    ok('Điểm trong khoảng 0..100: ' + n + ' (=' + s + ')', s >= 0 && s <= 100);
});

['0888862157', '0888841234', '0999626466', '0888888888'].forEach(function (n) {
    ok('Chấm điểm lặp lại giống nhau: ' + n, JSON.stringify(sim(n)) === JSON.stringify(sim(n)));
});

// ===========================================================================
// Tổng kết
// ===========================================================================
log('');
if (stats.fail === 0) {
    log('ALL PASSED  (' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
