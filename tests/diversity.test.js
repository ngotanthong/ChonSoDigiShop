// tests/diversity.test.js
// Kiểm tra bộ "đa dạng hoá" danh sách số (diversifyScoredList trong ai-scoring.js):
//   - Không để 1 kiểu số chiếm hết danh sách (mỗi vòng lấy 1 số của mỗi kiểu)
//   - Chống trùng lặp gần giống: cùng nét đẹp + cùng cụm highlight + cùng vị trí
//     chỉ giữ tối đa maxPerSignature số ở nhóm đầu (không xoá, đẩy xuống cuối)
//   - Vẫn giữ được điểm cao ở đầu (không đảo điểm quá nhiều)
//
// Cách chạy: bash tests/run.sh

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
        throw new Error('Không nạp được ai-scoring.js');
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

// --- Dữ liệu giả: 20 số "Sảnh Giữa" (cùng dấu hiệu 1234) + vài kiểu khác ---
function item(num, score, tag, hl) {
    return {
        fNum: num,
        ai: {
            score: score,
            primaryTag: tag,
            primaryHighlight: hl,
            highlight: hl,
            reasonsArr: [tag]
        }
    };
}

var list = [];
// 20 số cùng cụm 1234 ở cùng vị trí (trùng lặp gần giống)
for (var i = 0; i < 20; i++) {
    list.push(item('081' + (1000000 + i) + '', 50 - i, 'Sảnh Giữa', '1234'));
}
// các kiểu khác, điểm thấp hơn
list.push(item('0912345678', 30, 'Thần Tài', '78'));
list.push(item('0912345679', 29, 'Ông Địa', '79'));
list.push(item('0912345688', 28, 'Lộc Phát', '68'));
list.push(item('0912345699', 27, 'Số Cặp', '88'));
list.push(item('0912345611', 26, 'Dễ Nhớ', '11'));
list.push(item('0912345622', 25, 'Gánh Cặp', '22'));

var out = diversifyScoredList(list, { maxPerSignature: 3, bandSize: 0 });

ok('không làm mất số nào', out.length === list.length);
ok('không nhân bản số', new Set(out.map(x => x.fNum)).size === list.length);

var first12 = out.slice(0, 12).map(x => x.ai.reasonsArr[0]);
ok('12 số đầu có >= 5 kiểu khác nhau (không dồn 1 kiểu)',
    new Set(first12).size >= 5);
ok('số đầu tiên vẫn là số điểm cao nhất', out[0].ai.score === 50);

// Đếm số "Sảnh Giữa" trong 12 đầu: không được chiếm quá nửa
var sanhInFirst12 = out.slice(0, 12).filter(x => x.ai.reasonsArr[0] === 'Sảnh Giữa').length;
ok('Sảnh Giữa không chiếm quá nửa 12 số đầu', sanhInFirst12 <= 6);

// Chống trùng: nhóm đầu (trước phần "dồn xuống cuối") mỗi dấu hiệu tối đa 3.
// Nhóm đầu = 3 số trùng được giữ + 6 kiểu khác = 9 số.
var sigCount = {};
out.slice(0, 9).forEach(function (x) {
    var s = simPatternSignature(x);
    if (!s) return;
    sigCount[s] = (sigCount[s] || 0) + 1;
});
var maxSig = Math.max.apply(null, Object.keys(sigCount).map(k => sigCount[k]).concat([0]));
ok('mỗi dấu hiệu trùng tối đa 3 số ở nhóm đầu', maxSig <= 3);
// Số trùng thứ 4 bị đẩy xuống sau nhóm đầu (không bị xoá)
var fourthIdx = -1;
for (var q = 9; q < out.length; q++) {
    if (simPatternSignature(out[q]) === 'Sảnh Giữa|1234|-1') { fourthIdx = q; break; }
}
ok('số gần trùng thứ 4 bị đẩy xuống cuối (không xoá)', fourthIdx >= 9);

// Cụm highlight ngắn (2 số) không bị coi là trùng
ok('cụm 2 số không tạo dấu hiệu trùng',
    simPatternSignature(item('0912345678', 30, 'Thần Tài', '78')) === '');
ok('cụm >= 3 số tạo dấu hiệu trùng',
    simPatternSignature(item('0814312342', 50, 'Sảnh Giữa', '1234')) === 'Sảnh Giữa|1234|5');

// bandSize: giữ điểm gần đúng (không đảo quá xa).
// Dùng dữ liệu không có số gần trùng (mỗi số 1 cụm highlight riêng) để chỉ đo
// tác dụng của bandSize, không bị phần "dồn số trùng xuống cuối" làm nhiễu.
var bandList = [];
var tags4 = ['Thần Tài', 'Ông Địa', 'Lộc Phát', 'Sảnh Giữa'];
for (var b = 0; b < 24; b++) {
    var hl = '9' + (100 + b) + '9'; // luôn >= 3 ký tự và khác nhau
    bandList.push(item('091234' + (1000 + b) + '', 60 - b, tags4[b % 4], hl));
}
var banded = diversifyScoredList(bandList, { maxPerSignature: 3, bandSize: 20 });
ok('bandSize=20 giữ số điểm cao nhất ở đầu', banded[0].ai.score === 60);
var maxJump = 0;
for (var k = 1; k < banded.length; k++) {
    var jump = banded[k].ai.score - banded[k - 1].ai.score;
    if (jump > maxJump) maxJump = jump;
}
ok('bandSize=20 không đảo điểm quá 20', maxJump <= 20);

// Danh sách rỗng / không có ai vẫn chạy được
ok('danh sách rỗng trả về rỗng', diversifyScoredList([], {}).length === 0);
var noAI = diversifyScoredList([{ fNum: '0912345678' }, { fNum: '0912345679' }], {});
ok('số không có AI vẫn được giữ', noAI.length === 2);

// ---------------- 12. Bố cục bảng in: dòng 1 điểm cao nhất, dòng 2+ 1 kiểu/dòng ----------------
var gridList = [];
for (var g1 = 0; g1 < 14; g1++) gridList.push(item('081' + (2000000 + g1) + '', 50 - g1, 'A', '1' + g1 + '11'));
for (var g2 = 0; g2 < 6; g2++) gridList.push(item('082' + (3000000 + g2) + '', 30 - g2, 'B', '2' + g2 + '22'));
for (var g3 = 0; g3 < 5; g3++) gridList.push(item('083' + (4000000 + g3) + '', 25 - g3, 'C', '3' + g3 + '33'));
for (var g4 = 0; g4 < 5; g4++) gridList.push(item('084' + (5000000 + g4) + '', 20 - g4, 'D', '4' + g4 + '44'));

var grid = layoutPrintRows(gridList, 4);
ok('bố cục in: giữ đủ số', grid.length === gridList.length);
ok('bố cục in: không nhân bản số', new Set(grid.map(x => x.fNum)).size === gridList.length);
ok('bố cục in: không có ô trống', grid.every(x => !!x));

var topRow = grid.slice(0, 4).map(x => x.ai.score);
ok('bố cục in: dòng 1 = 4 điểm AI cao nhất (giảm dần)', topRow.join(',') === '50,49,48,47');

// Từ ô thứ 5 trở đi: mỗi kiểu là 1 khối liền nhau, khối điểm cao đứng trước
var blocks = [];
for (var bi = 4; bi < grid.length; bi++) {
    var bt = grid[bi].ai.reasonsArr[0];
    if (!blocks.length || blocks[blocks.length - 1].tag !== bt) {
        blocks.push({ tag: bt, items: [grid[bi]] });
    } else {
        blocks[blocks.length - 1].items.push(grid[bi]);
    }
}
ok('bố cục in: từ dòng 2 mỗi kiểu là 1 khối liền nhau', blocks.length === 4);
ok('bố cục in: khối điểm cao đứng trước',
    blocks.map(b => b.tag).join(',') === 'A,B,C,D');

var blocksDesc = true;
blocks.forEach(function (b) {
    for (var q3 = 1; q3 < b.items.length; q3++) {
        if (b.items[q3].ai.score > b.items[q3 - 1].ai.score) blocksDesc = false;
    }
});
ok('bố cục in: trong mỗi khối, điểm cao đứng trước', blocksDesc);

// Toàn bộ cùng 1 kiểu vẫn không lỗi / không mất số
var onlyA = gridList.filter(x => x.ai.reasonsArr[0] === 'A');
ok('bố cục in: toàn 1 kiểu vẫn giữ đủ số', layoutPrintRows(onlyA, 4).length === onlyA.length);

// Danh sách ngắn hơn 1 dòng
ok('bố cục in: danh sách ngắn vẫn đủ', layoutPrintRows(gridList.slice(0, 3), 4).length === 3);

// 1 kiểu ít số (1 số) đứng sau vẫn không tạo ô trống
var smallList = gridList.slice(0, 4).concat([item('0859999999', 5, 'E', '999')]);
var smallGrid = layoutPrintRows(smallList, 4);
ok('bố cục in: kiểu ít số vẫn đủ ô, không trống', smallGrid.length === 5 && smallGrid.every(x => !!x));

// ---------------- 13. Chia suất bảng in theo kiểu số ----------------
var plan1 = buildPrintPlan(gridList, 12, { maxPerSignature: 3 });
ok('bảng in: đúng số ô cần in', plan1.total === 12 && plan1.items.length === 12);
ok('bảng in: không nhân bản số', new Set(plan1.items.map(x => x.fNum)).size === 12);
var planTags = plan1.items.slice(0, 4).map(x => x.ai.reasonsArr[0]);
ok('bảng in: 4 số đầu là 4 kiểu khác nhau', new Set(planTags).size === 4);

var planCountSum = plan1.groups.reduce(function (s, g) { return s + g.count; }, 0);
ok('bảng in: tổng suất = số ô', planCountSum === 12);
ok('bảng in: kiểu nào cũng có suất', plan1.groups.every(g => g.count >= 1));

var planSorted = true;
for (var pg = 1; pg < plan1.groups.length; pg++) {
    if (plan1.groups[pg].top > plan1.groups[pg - 1].top) planSorted = false;
}
ok('bảng in: kiểu điểm cao nhất đứng trước', planSorted);

var planInnerSorted = true;
plan1.groups.forEach(function (g) {
    var itemsOfType = plan1.items.filter(function (x) { return x.ai.reasonsArr[0] === g.name; });
    for (var q2 = 1; q2 < itemsOfType.length; q2++) {
        if (itemsOfType[q2].ai.score > itemsOfType[q2 - 1].ai.score) planInnerSorted = false;
    }
});
ok('bảng in: trong 1 kiểu, điểm cao đứng trước', planInnerSorted);

// Nguồn ít hơn số ô -> in hết, không bịa thêm
var planShort = buildPrintPlan(gridList.slice(0, 7), 40, { maxPerSignature: 3 });
ok('bảng in: nguồn ít hơn số ô -> in hết', planShort.total === 7);

// Chỉ có 1 kiểu -> vẫn in đủ số, không lỗi
var planOne = buildPrintPlan(gridList.filter(x => x.ai.reasonsArr[0] === 'A'), 5, { maxPerSignature: 3 });
ok('bảng in: 1 kiểu duy nhất vẫn in đủ', planOne.total === 5);

// limit = 0
ok('bảng in: limit 0 -> 0 số', buildPrintPlan(gridList, 0, {}).total === 0);

log('');
if (stats.fail === 0) {
    log('ALL PASSED  (diversity: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
