// tests/beauty-filter.test.js
// Khóa tính năng "bộ lọc nét đẹp" (tag phân tích giống sodep) ở trang tìm thủ công index.html:
//   - Có dãy tag riêng (#beautyCloud) lấy từ ai.reasonsArr (Lặp Cặp, Nút 9, Tam Hoa...)
//   - Bấm vào tag = LỌC thật (không chỉ đẩy lên đầu)
//   - Lọc kiểu số (kieuso_name) cũng thành lọc thật
//   - Có thông báo khi bộ lọc ra 0 kết quả + nút xoá bộ lọc
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

var html = readRepoFile('index.html');

// --- 1. UI ---
ok('có khung #beautyCloud', html.indexOf('id="beautyCloud"') !== -1);
ok('#beautyCloud nằm trong #tagArea',
    /id="tagCloud"[\s\S]{0,8000}?id="beautyCloud"/.test(html));
ok('có nút "Tất cả nét đẹp"', html.indexOf('✨ Tất cả nét đẹp') !== -1);

// --- 2. State ---
ok('có biến filterBeauty', /let filterBeauty = null;/.test(html));
ok('reset filterBeauty khi tìm mới', /sortPrice = null;\s*filterBeauty = null;\s*renderTags\(currentData\);/.test(html));

// --- 3. Nguồn tag = kết quả phân tích (ai.reasonsArr) ---
ok('có cache _aiCache', /const _aiCache = \{\};/.test(html));
ok('có getItemAI()', /function getItemAI\(item\)/.test(html));
ok('getItemAI cache theo số|cước', /const key = num \+ '\|' \+ fee;/.test(html));
ok('có getItemReasons()', /function getItemReasons\(item\)/.test(html));
ok('getItemReasons lấy ai.reasonsArr', /Array\.isArray\(ai\.reasonsArr\)/.test(html));

// --- 4. Render tag ---
ok('renderTags lấy #beautyCloud', /const beautyCloud = document\.getElementById\('beautyCloud'\)/.test(html));
ok('renderTags xoá cloud mỗi lần vẽ', /beautyCloud\.innerHTML = ''/.test(html));
ok('đếm số lượng từng tag', /reasonCounts\.set\(r, \(reasonCounts\.get\(r\) \|\| 0\) \+ 1\)/.test(html));
ok('tag hiển thị kèm số lượng', /btn\.textContent = `\$\{tag\} \(\$\{count\}\)`;/.test(html));
ok('click tag bật/tắt filterBeauty', /filterBeauty = \(filterBeauty === tag\) \? null : tag;/.test(html));
ok('sắp xếp tag theo số lượng giảm dần', /b\[1\] - a\[1\]/.test(html));

// --- 5. Lọc thật trong applySort ---
ok('applySort lọc theo filterBeauty',
    /if \(filterBeauty !== null\) \{\s*sorted = sorted\.filter\(item => getItemReasons\(item\)\.indexOf\(filterBeauty\) !== -1\);/.test(html));
ok('có kieuTagName() làm sạch tên kiểu số', /function kieuTagName\(item\)/.test(html));
ok('kieuTagName bỏ thẻ <br> trong dữ liệu VNPT',
    html.indexOf('function kieuTagName(item)') !== -1 && html.indexOf('<br\\s*\\/?>') !== -1);
ok('lọc kiểu số là filter (không còn tách matches/others)',
    /sorted = sorted\.filter\(item => kieuTagName\(item\) === priorityTag\);/.test(html));
ok('bỏ đoạn reorder matches/others cũ',
    html.indexOf('const others = sorted.filter') === -1);

// --- 6. Trạng thái rỗng ---
ok('có clearAllFilters()', /function clearAllFilters\(\)/.test(html));
ok('clearAllFilters xoá filterBeauty', /function clearAllFilters\(\)[\s\S]{0,300}filterBeauty = null;/.test(html));
ok('có thông báo khi 0 kết quả', html.indexOf('Không có số nào phù hợp bộ lọc hiện tại.') !== -1);
ok('có nút "Xoá tất cả bộ lọc"', html.indexOf('>Xoá tất cả bộ lọc</button>') !== -1);

log('');
if (stats.fail === 0) {
    log('ALL PASSED  (beauty-filter: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
