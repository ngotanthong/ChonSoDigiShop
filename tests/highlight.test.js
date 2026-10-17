// tests/highlight.test.js
// Bộ test cho hàm hiển thị số `highlightHTML` và sự ĐỒNG BỘ giữa các trang.
//
// Mục đích:
//   1. NHỊP (dấu cách) và MARK (vùng bôi đỏ) luôn khớp nhau — dấu cách không
//      cắt ngang vùng mark, trừ những pattern cố ý chia nhỏ vùng mark.
//   2. `highlightHTML` chỉ định nghĩa DUY NHẤT trong ai-scoring.js và được
//      dùng chung cho sodep.html (Quét / Phong Thủy / bản in) + index.html
//      (Tìm Thủ Công), tránh lệch nhau giữa các trang.
//
// Cách chạy:
//   bash tests/run.sh
//   jsc tests/highlight.test.js      (chạy từ thư mục gốc repo)
//   node tests/highlight.test.js

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

// ---------------------------------------------------------------------------
// Nạp ai-scoring.js (chứa cả analyzeSIM và highlightHTML)
// ---------------------------------------------------------------------------
(function loadEngine() {
    if (IS_NODE) {
        var path = require('path');
        var fs = require('fs');
        (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'ai-scoring.js'), 'utf8'));
    } else if (typeof load === 'function') {
        load('ai-scoring.js');
    } else {
        throw new Error('Không nạp được ai-scoring.js (cần node hoặc jsc).');
    }
})();

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
    return html.replace(/<span class="hi(?:[^"]*)">/g, '[').replace(/<\/span>/g, ']');
}

// Với 1 số: lấy dữ liệu thật từ engine rồi render
function render(n) {
    var r = analyzeSIM(n, 0);
    var hl = r.primaryHighlight || r.highlight;
    return {
        num: n,
        hl: hl,
        tag: r.primaryTag,
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
// 0. highlightHTML phải tồn tại (đến từ ai-scoring.js) và là 1 nguồn duy nhất
// ===========================================================================
ok('highlightHTML có sẵn sau khi nạp ai-scoring.js', typeof highlightHTML === 'function');

(function () {
    var sodep = readRepoFile('sodep.html');
    var index = readRepoFile('index.html');
    ok('sodep.html KHÔNG định nghĩa lại highlightHTML', sodep.indexOf('function highlightHTML(') === -1);
    ok('index.html KHÔNG định nghĩa lại highlightHTML', index.indexOf('function highlightHTML(') === -1);
    ok('index.html có dùng highlightHTML để hiển thị số', /highlightHTML\(/.test(index));
})();

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
// 4. Từ khoá đang tìm (.sh) — không được vỡ bởi nhịp/mark, mark luôn ưu tiên
// ===========================================================================
(function () {
    var html = highlightHTML('0912345678', '5678', 'Sảnh Tiến Lớn', 'Sảnh Tiến Lớn', ['234']);
    ok('Từ khoá đang tìm được bọc .sh: ' + html,
        html.indexOf('<span class="sh">234</span>') !== -1);
    ok('Từ khoá .sh không bị lồng trong .hi (mark ưu tiên)',
        !/<span class="hi">[^<]*<span class="sh">/.test(html));

    // Trùng hoàn toàn vùng mark -> chỉ còn .hi (đỏ), không có .sh
    var html2 = highlightHTML('0912810880', '0880', 'Gánh Đảo', 'Gánh Đảo', ['880']);
    ok('Trùng vùng mark: không sinh thêm .sh', html2.indexOf('class="sh"') === -1);
    ok('Trùng vùng mark: nhịp vẫn không cắt mark', view(html2) === '0912 81 [0880]');
})();

// ===========================================================================
// 5. Đồng bộ CSS: mark phải đỏ ở CẢ HAI trang
// ===========================================================================
(function () {
    var sodep = readRepoFile('sodep.html');
    var index = readRepoFile('index.html');

    // sodep.html: có rule .hi toàn cục (không chỉ scope trong .sim-number)
    ok('sodep.html: rule .hi được áp toàn cục (mark đỏ cả card Phong Thủy/bản in)',
        /(^|\n)\s*\.hi\s*[,{]/.test(sodep));

    // index.html: mark .hi đỏ, chữ tìm kiếm chuyển sang .sh
    var hiBlock = index.match(/\.sim-number\s+\.hi\s*\{[^}]*\}/);
    ok('index.html: .sim-number .hi là màu đỏ', !!hiBlock && /#e11d48/.test(hiBlock[0]));
    ok('index.html: chữ đang tìm dùng class .sh', /\.sim-number\s+\.sh\s*\{/.test(index));
})();

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
