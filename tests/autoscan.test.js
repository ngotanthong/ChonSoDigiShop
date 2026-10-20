// tests/autoscan.test.js
// Khóa lại cơ chế quét ngầm (background scan) trong sodep.html:
//   - không chạy chồng chéo (setTimeout nối tiếp thay vì setInterval)
//   - có báo tiến độ theo từng đợt: số lượt, số mới thêm, thời gian
//   - có nút Dừng
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

var sodep = readRepoFile('sodep.html');

// --- 1. Không còn setInterval gọi silentAutoScan (nguyên nhân chồng chéo) ---
ok('không còn setInterval(silentAutoScan)',
    sodep.indexOf('setInterval(silentAutoScan') === -1);
ok('có AUTO_SCAN_INTERVAL (10 phút) tính từ lúc lượt trước kết thúc',
    /const AUTO_SCAN_INTERVAL = 600000;/.test(sodep));
ok('enableAutoReload dùng setTimeout nối tiếp',
    /function enableAutoReload\(\)[\s\S]{0,400}setTimeout\(runAutoScanLoop/.test(sodep));
ok('runAutoScanLoop hẹn lượt kế tiếp sau khi xong',
    /async function runAutoScanLoop\(\)[\s\S]{0,200}silentAutoScan\(\)[\s\S]{0,200}AUTO_SCAN_INTERVAL/.test(sodep));

// --- 2. Chặn chồng chéo ---
ok('có cờ autoScanRunning', /let autoScanRunning = false;/.test(sodep));
ok('silentAutoScan thoát nếu lượt trước chưa xong',
    /if \(autoScanRunning\) \{[\s\S]{0,160}return;/.test(sodep));
ok('silentAutoScan nhường khi đang quét tay', /&& activeScan\) \{[\s\S]{0,120}return;/.test(sodep));

// --- 3. Báo tiến độ theo đợt ---
ok('có BATCH_SIZE (chia đợt)', /const BATCH_SIZE = \d+;/.test(sodep));
ok('có finishBatch()', /function finishBatch\(\)/.test(sodep));
ok('có bgRender()', /function bgRender\(stats, state\)/.test(sodep));
ok('có bgLogBatch()', /function bgLogBatch\(stats\)/.test(sodep));
ok('có bgFmtDuration() (định dạng thời gian)',
    /function bgFmtDuration\(ms\)/.test(sodep));
ok('mỗi lượt tăng stats.done', /stats\.done\+\+;/.test(sodep));
ok('mỗi lượt tăng stats.total khi thêm task', /stats\.total\+\+;/.test(sodep));
ok('báo số mới thêm vào stats.added', /stats\.added \+= freshData\.length;/.test(sodep));
ok('cập nhật UI sau mỗi lượt', /bgRender\(stats, 'running'\);/.test(sodep));

// --- 4. Panel hiển thị ---
ok('có panel #bgScanPanel', sodep.indexOf('id="bgScanPanel"') !== -1);
ok('có dòng lượt/đợt #bgScanLine1', sodep.indexOf('id="bgScanLine1"') !== -1);
ok('có dòng thời gian #bgScanLine2', sodep.indexOf('id="bgScanLine2"') !== -1);
ok('có log từng đợt #bgScanLog', sodep.indexOf('id="bgScanLog"') !== -1);

// --- 5. Nút Dừng ---
ok('có nút Dừng', sodep.indexOf('id="bgScanStop"') !== -1);
ok('có stopAutoScan()', /function stopAutoScan\(\)/.test(sodep));
ok('stopAutoScan bật cờ autoScanAbort', /autoScanAbort = true;/.test(sodep));
ok('worker dừng khi bấm Dừng', /while \(tasks\.length > 0 && !autoScanAbort\)/.test(sodep));
ok('trạng thái "stopped" được render', /autoScanAbort \? 'stopped' : 'done'/.test(sodep));

// --- 6. Cập nhật "lần cuối" sau khi quét xong ---
ok('có gọi updateLastFetchTime() ở cuối lượt quét',
    /updateLastFetchTime\(\);[\s\S]{0,200}catch \(err\)/.test(sodep));

log('');
if (stats.fail === 0) {
    log('ALL PASSED  (autoscan: ' + stats.pass + ' kiểm tra)');
} else {
    log('FAILED: ' + stats.fail + '/' + (stats.pass + stats.fail) + ' kiểm tra thất bại:');
    failures.forEach(function (f) { log('  x ' + f); });
    if (typeof quit === 'function') quit(1);
    else if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
