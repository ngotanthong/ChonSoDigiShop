// tests/highlight.test.js
// Bộ test cho hàm hiển thị số `highlightHTML` (nằm trong sodep.html).
//
// Mục đích: đảm bảo NHỊP (dấu cách) và MARK (vùng bôi đỏ) luôn ĐỒNG BỘ —
// dấu cách không được cắt ngang vùng bôi đỏ, trừ những pattern cố ý chia
// nhỏ vùng mark (Đồng Kẹp Tiến 3-3, Lặp Xen Kẽ 2-2-2, ...).
//
// Cách chạy:
//   bash tests/run.sh
//   jsc tests/highlight.test.js      (chạy từ thư mục gốc repo)
//   node tests/highlight.test.js

// ---------------------------------------------------------------------------
// Nạp ai-scoring.js (để lấy primaryTag/primaryHighlight/reasonText thật)
// ---------------------------------------------------------------------------
(function loadEngine() {
    var fs = null;
    try { fs = require('fs'); } catch (e) { fs = null; }
    if (fs) {
        var path = require('path');
        var src = fs.readFileSync(path.join(__dirname, '..', 'ai-scoring.js'), 'utf8');
        (0, eval)(src);
    } else if (typeof load === 'function') {
        load('ai-scoring.js');
    } else {
        throw new Error('Không nạp được ai-scoring.js (cần node hoặc jsc).');
    }
})();

// ---------------------------------------------------------------------------
// Trích hàm highlightHTML ra khỏi sodep.html (đếm ngoặc để lấy trọn hàm)
// ---------------------------------------------------------------------------
function extractHighlightHTML() {
    var src = null;
    var fs = null;
    try { fs = require('fs'); } catch (e) { fs = null; }
    if (fs) {
        var path = require('path');
        src = fs.readFileSync(path.join(__dirname, '..', 'sodep.html'), 'utf8');
    } else if (typeof readFile === 'function') {
        src = readFile('sodep.html');
    } else {
        throw new Error('Không đọc được sodep.html (cần node hoặc jsc).');
    }

    var start = src.indexOf('function highlightHTML(');
    if (start < 0) throw new Error('Không tìm thấy highlightHTML trong sodep.html.');

    var open = src.indexOf('{', start);
    var depth = 0;
    var i = open;
    for (; i < src.length; i++) {
        var ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) { i++; break; }
        }
    }
    return src.slice(start, i);
}

var highlightHTML = (0, eval)('(' + extractHighlightHTML() + ')');

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
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

// Hiển thị dạng dễ đọc: <span class="hi">X</span> -> [X], dấu cách giữ nguyên
function view(html) {
    return html.replace(/<span class="hi">/g, '[').replace(/<\/span>/g, ']');
}

// Với 1 số: lấy dữ liệu thật từ engine rồi render
function render(n) {
    var r = analyzeSIM(n, 0);
    var hl = r.primaryHighlight || r.highlight;
    return {
        num: n,
        hl: hl,
        tag: r.primaryTag,
        reason: r.reasonText,
        html: highlightHTML(n, hl, r.reasonText, r.primaryTag),
        view: view(highlightHTML(n, hl, r.reasonText, r.primaryTag))
    };
}

// Vị trí các dấu cách trong chuỗi hiển thị (bỏ qua thẻ HTML)
function dotPositions(html) {
    var out = [];
    var vis = 0;
    var i = 0;
    while (i < html.length) {
        if (html[i] === '<') { i = html.indexOf('>', i) + 1; continue; }
        if (html[i] === ' ') out.push(vis);
        else vis++;
        i++;
    }
    return out;
}

// ===========================================================================
// 1. LỖI ĐÃ SỬA: Gánh Đảo + (Đồng Kẹp Tiến) -> nhịp KHÔNG được cắt vùng mark
//    Trước đây: "0912 81[0 880]"  (dấu cách lọt vào giữa "0880")
// ===========================================================================
(function () {
    var html = highlightHTML('0912810880', '0880', 'Gánh Đảo + Nút 7 + Đồng Kẹp Tiến', 'Gánh Đảo');
    ok('0912810880: nhịp & mark đồng bộ (mark "0880" liền khối)', view(html) === '0912 81 [0880]');

    var dots = dotPositions(html);
    var idx = '0912810880'.lastIndexOf('0880');
    var cut = dots.filter(function (d) { return d > idx && d < idx + 4; });
    ok('0912810880: không có dấu cách nào nằm trong vùng bôi đỏ', cut.length === 0);
})();

// Cùng số đó, nhưng mark thật sự là 6 số cuối của Đồng Kẹp Tiến -> vẫn 4-3-3
(function () {
    var html = highlightHTML('0588608658', '608658', 'Đồng Kẹp Tiến', 'Đồng Kẹp Tiến');
    ok('Đồng Kẹp Tiến 6 số cuối vẫn chia nhịp 3-3', view(html) === '0588 [608 658]');
})();

// ===========================================================================
// 2. Quét bằng dữ liệu engine thật: nhịp phải khớp mark
//    Ngoại lệ: các pattern CỐ Ý chia nhỏ vùng mark.
// ===========================================================================
var MULTI_PART = /Đồng Kẹp|Lặp Cụm|Lặp Xen Kẽ|Gánh Cặp|Gánh Kép|Taxi|Số Cặp|Lặp Cặp|Cặp Tiến|Cụm 4|Siêu Dễ Nhớ|Ngũ Quý/;

[
    '0912810880', '0888123456', '0912345678', '0999626466', '0812346666',
    '0888864082', '0912088080', '0812308080', '0911056070', '0912056070',
    '0886612088', '0912346868', '0812323262', '0912345080', '0844446215',
    '0909876543', '0912812088', '0812345678'
].forEach(function (n) {
    var info = render(n);
    if (!info.hl) return;
    if (MULTI_PART.test(info.tag || '')) return; // pattern cố ý chia nhỏ -> bỏ qua
    var idx = n.lastIndexOf(info.hl);
    var cut = dotPositions(info.html).filter(function (d) { return d > idx && d < idx + info.hl.length; });
    ok('Nhịp không cắt vùng mark: ' + n + ' (' + info.tag + ') -> ' + info.view, cut.length === 0);
});

// ===========================================================================
// 3. Khóa (golden) một số kiểu hiển thị đã thống nhất
// ===========================================================================
[
    ['0912810880', '0912 81 [0880]'],   // Gánh Đảo 4 số
    ['0888123456', '088 812 [3456]'],   // Sảnh Tiến Lớn
    ['0912346666', '091 234 [6666]'],   // Tứ Quý
    ['0999626466', '0999 [62 64 66]'],  // Lặp Xen Kẽ 2-2-2
    ['0912506070', '0912 [50 6070]'],   // Cặp Tiến 3 Bậc
    ['0812323262', '08 [123] 23262']    // Sảnh Giữa
].forEach(function (pair) {
    var info = render(pair[0]);
    ok('Hiển thị đúng: ' + pair[0] + ' -> ' + pair[1] + '  (nhận: ' + info.view + ')', info.view === pair[1]);
});

// ===========================================================================
// Tổng kết
// ===========================================================================
log('');
if (stats.fail === 0) {
    log('ALL PASSED  (highlight: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
