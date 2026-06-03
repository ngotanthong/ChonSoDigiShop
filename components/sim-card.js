/* components/sim-card.js */

function formatSIMNumber(num) {
    return num.startsWith('84') ? '0' + num.slice(2) : num;
}

function highlightHTML(numStr, matchStr) {
    if (!numStr || numStr.length !== 10) {
        if (!matchStr) return numStr;
        const parts = matchStr.split('*').filter(p => p.trim() !== '');
        if (parts.length === 0) return numStr;
        const safeParts = parts
            .sort((a, b) => b.length - a.length)
            .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const reg = new RegExp(`(${safeParts.join('|')})`, 'g');
        return numStr.replace(reg, '<span class="hi">$1</span>');
    }

    let dotIndexes = [];
    if (/(.)\1{4}$/.test(numStr)) { // Ngũ quý
        dotIndexes = [3, 5];
    } else if (/(.)\1{3}$/.test(numStr)) { // Tứ quý
        dotIndexes = [3, 6];
    } else if (/(\d{3})\1$/.test(numStr)) { // Taxi 3 cụm
        dotIndexes = [4, 7];
    } else if (/(\d{2})\1\1$/.test(numStr) || /(\d{2})\d{2}\1$/.test(numStr)) { // Lặp cặp
        dotIndexes = [4, 6, 8];
    } else if (/(\d{2})\1$/.test(numStr) || /(\d)\1(\d)\2$/.test(numStr) || /(\d)(\d)\2\1$/.test(numStr)) { 
        dotIndexes = [3, 6, 8];
    } else {
        dotIndexes = [3, 6]; // Default 3-3-4
    }

    let html = '';
    
    // For wildcard match support
    let regMatch = matchStr;
    if (matchStr && matchStr.includes('*')) {
        const parts = matchStr.split('*').filter(p => p.trim() !== '');
        const safeParts = parts.sort((a, b) => b.length - a.length).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const reg = new RegExp(`(${safeParts.join('|')})`, 'g');
        return numStr.replace(reg, '<span class="hi">$1</span>');
    }

    const idx = matchStr ? numStr.lastIndexOf(matchStr) : -1;

    for (let i = 0; i < numStr.length; i++) {
        if (dotIndexes.includes(i)) html += ' '; 

        if (i === idx) html += '<span class="hi">';

        html += numStr[i];

        if (matchStr && i === idx + matchStr.length - 1) html += '</span>';
    }
    return html;
}

function analyzeSIM(numStr, monthlyFee = 0) {
    let score = 0;
    let categories = [];
    let reasons = [];
    let highlight = '';

    // 1. Tứ Quý (4 số giống nhau ở cuối)
    if (/(.)\1{3}$/.test(numStr)) {
        score += 50;
        categories.push('tuquy');
        reasons.push('Tứ Quý');
        highlight = numStr.slice(-4);
    }
    // 2. Tam Hoa (3 số giống nhau ở cuối)
    else if (/(.)\1{2}$/.test(numStr)) {
        score += 30;
        categories.push('tamhoa');
        reasons.push('Tam Hoa');
        highlight = numStr.slice(-3);
    }

    // 3. Lộc Phát (chứa 68, 86, 168, 868 ở cuối)
    if (/(168|868)$/.test(numStr)) {
        score += 35;
        categories.push('locphat');
        reasons.push('Phát Lộc Phát');
        highlight = highlight || numStr.slice(-3);
    } else if (/(68|86)$/.test(numStr)) {
        score += 25;
        categories.push('locphat');
        reasons.push('Lộc Phát');
        highlight = highlight || numStr.slice(-2);
    }

    // 4. Số Tiến (1234, 6789, 2345)
    if (/(0123|1234|2345|3456|4567|5678|6789)$/.test(numStr)) {
        score += 35;
        categories.push('sotien');
        reasons.push('Tiến Lên Đẹp');
        highlight = highlight || numStr.slice(-4);
    } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
        score += 15;
        categories.push('sotien');
        reasons.push('Số Tiến');
        highlight = highlight || numStr.slice(-3);
    }

    // 5. Số Lặp Cao Cấp (Taxi, Lặp Kép) & Lặp Thường (ABAB)
    let isLap = false;
    if (/(\d{2})\1\1$/.test(numStr)) { // ABABAB (Taxi 3 cặp)
        score += 45;
        categories.push('solap');
        reasons.push('Taxi Đẹp');
        highlight = highlight || numStr.slice(-6);
        isLap = true;
    } else if (/(\d{3})\1$/.test(numStr)) { // ABCABC (Taxi cụm 3)
        score += 40;
        categories.push('solap');
        reasons.push('Taxi Đẹp');
        highlight = highlight || numStr.slice(-6);
        isLap = true;
    } else if (/(\d)\1(\d)\2$/.test(numStr) && numStr.slice(-2, -1) !== numStr.slice(-1)) { // AABB
        score += 25;
        categories.push('solap');
        reasons.push('Lặp Kép');
        highlight = highlight || numStr.slice(-4);
        isLap = true;
    } else if (/(\d{2})\1$/.test(numStr)) { // ABAB
        score += 20;
        categories.push('solap');
        reasons.push('Lặp Cặp');
        highlight = highlight || numStr.slice(-4);
        isLap = true;
    }

    // 5.5. Số Gánh / Số Đảo (ABBA, ABA, AB CD AB)
    if (!isLap) {
        const matchGanhCap = numStr.match(/(\d{2})(\d{2})\1$/);
        if (matchGanhCap && Math.abs(parseInt(matchGanhCap[1]) - parseInt(matchGanhCap[2])) <= 2) { // AB CD AB (Gánh cặp 6 số gần nhau)
            score += 30;
            categories.push('soganh');
            reasons.push('Gánh Cặp');
            highlight = highlight || numStr.slice(-6);
        } else if (/(\d)(\d)\2\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) { // ABBA
            score += 25;
            categories.push('soganh');
            reasons.push('Gánh Đảo');
            highlight = highlight || numStr.slice(-4);
        } else if (/(\d)(\d)\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) { // ABA
            score += 15;
            categories.push('soganh');
            reasons.push('Gánh');
            highlight = highlight || numStr.slice(-3);
        }
    }

    // 5.7. Cặp Tiến (ví dụ 1415, 1315, 31415 ở đuôi)
    const last4Digits = numStr.slice(-4);
    if (last4Digits.length === 4) {
        const d1 = parseInt(last4Digits[0]);
        const d2 = parseInt(last4Digits[1]);
        const d3 = parseInt(last4Digits[2]);
        const d4 = parseInt(last4Digits[3]);
        if (d1 === d3 && d4 > d2) {
            score += 15;
            categories.push('captien');
            reasons.push('Cặp Tiến');
            highlight = highlight || last4Digits;
        }
    }

    // 6. Đuôi Đẹp phong thủy (79: thần tài lớn, 39: thần tài nhỏ, 38: ông địa)
    if (/(79|39)$/.test(numStr)) {
        score += 20;
        categories.push('duoidep');
        categories.push('phongthuy');
        reasons.push('Thần Tài');
        highlight = highlight || numStr.slice(-2);
    } else if (/(38|78)$/.test(numStr)) {
        score += 15;
        categories.push('duoidep');
        categories.push('phongthuy');
        reasons.push('Ông Địa');
        highlight = highlight || numStr.slice(-2);
    }

    // 7. Tổng nút (tổng 10 số = 7, 8, 9 là đẹp)
    const sum10 = numStr.split('').reduce((acc, val) => acc + parseInt(val), 0);
    const nut = sum10 % 10;
    if (nut >= 7) { // Nút 7, 8, 9
        let point = 5;
        if (nut === 9) {
            point = 10; // 9 điểm cao nhất
            categories.push('phongthuy');
        }
        score += point;
        reasons.push('Nút ' + nut);
    }

    // 8. Trừ điểm số kỵ / Cộng số sạch
    if (/49|53/.test(numStr)) {
        score -= 15;
    } else if (!/4/.test(numStr) && !/7/.test(numStr)) {
        score += 10;
        reasons.push('Số Sạch');
    }

    // 9. Thuật toán "Số Ít Phím" (Dễ nhớ)
    const uniqueDigitsCount = new Set(numStr.split('')).size;
    if (uniqueDigitsCount <= 3) {
        score += 30;
        categories.push('denho');
        reasons.push('Siêu Dễ Nhớ');
    } else if (uniqueDigitsCount === 4) {
        score += 15;
        categories.push('denho');
        reasons.push('Dễ Nhớ');
    }

    // 10. Tiến Chẵn / Tiến Lẻ
    if (/(1357|3579)$/.test(numStr)) {
        score += 20;
        categories.push('sotien');
        reasons.push('Tiến Lẻ Đều');
        highlight = highlight || numStr.slice(-4);
    } else if (/(2468|0246|4680)$/.test(numStr)) {
        score += 20;
        categories.push('sotien');
        reasons.push('Tiến Chẵn Đều');
        highlight = highlight || numStr.slice(-4);
    }

    // 11. Đầu Đuôi Tương Phùng
    const prefix3 = numStr.slice(0, 3);
    const prefix4 = numStr.slice(0, 4);
    
    if (numStr.endsWith(prefix4)) {
        score += 25;
        categories.push('denho');
        reasons.push('Đầu Đuôi Tương Phùng');
        highlight = highlight || prefix4;
    } else if (numStr.endsWith(prefix3)) {
        score += 20;
        categories.push('denho');
        reasons.push('Đầu Đuôi Tương Phùng');
        highlight = highlight || prefix3;
    }

    // 12. Độ bằng phẳng (Lộn xộn)
    let flipCount = 0;
    let lastDirection = 0;
    for (let i = 1; i < numStr.length; i++) {
        let diff = parseInt(numStr[i]) - parseInt(numStr[i - 1]);
        if (diff > 0) {
            if (lastDirection === -1) flipCount++;
            lastDirection = 1;
        } else if (diff < 0) {
            if (lastDirection === 1) flipCount++;
            lastDirection = -1;
        }
    }
    if (flipCount > 5) {
        score -= 10;
    } else if (flipCount <= 2 && uniqueDigitsCount >= 5) {
        score += 5;
    }

    // 13. Ưu tiên số Rẻ & Đẹp (Cam kết <= 100k) có từ 3 tag trở lên
    const fee = Number(monthlyFee) || 0;
    if (fee <= 100000) {
        if (reasons.length >= 4) {
            score += 20;
            categories.push('phongthuy');
            reasons.push('Rẻ & Siêu Đẹp');
        } else if (reasons.length === 3) {
            score += 10;
            categories.push('phongthuy');
            reasons.push('Rẻ & Đẹp');
        }
    }

    return {
        score: score,
        categories: categories,
        reasonsArr: reasons,
        reasonText: reasons.join(' + ') || 'Phong Thủy Khá',
        highlight: highlight
    };
}

async function downloadCard(phoneNum, btnEl, event) {
    event.stopPropagation();

    const card = btnEl.closest('.sim-card');
    if (!card) return;

    if (typeof html2canvas === 'undefined') {
        alert("Tính năng đang tải thư viện, vui lòng thử lại sau vài giây.");
        return;
    }

    card.classList.add('is-capturing');

    const originalHTML = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="login-spinner" style="width: 12px; height: 12px; border-width: 1.5px; border-top-color: currentColor; display: inline-block;"></span>';

    try {
        const canvas = await html2canvas(card, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');

        const link = document.createElement('a');
        link.download = `SIM_VIP_${phoneNum}.png`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Lỗi chụp ảnh card:", err);
        alert("Không thể tải ảnh card này. Vui lòng thử lại!");
    } finally {
        card.classList.remove('is-capturing');
        btnEl.disabled = false;
        btnEl.innerHTML = originalHTML;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function createSimCardHTML(item, searchVal = '') {
    if (!item.ai) item.ai = analyzeSIM(formatSIMNumber(item.so_tb), item.monthly);

    const fNum = formatSIMNumber(item.so_tb);
    const hlStr = searchVal ? searchVal : item.ai.highlight;
    const hlNum = highlightHTML(fNum, hlStr);
    
    const isFree = !item.monthly || item.monthly == 0 || item.monthly === "0";
    const price = Number(item.monthly) || 0;
    const priceText = isFree ? '0 đ' : price.toLocaleString() + ' đ';
    const commitText = (item.commitment && item.commitment > 0) ? `<span>${item.commitment}</span> tháng` : 'Không có';
    
    const rawTagName = item.kieuso_name ? item.kieuso_name.replace(/^\d{3} /, '') : '';
    const tagName = escapeHTML(rawTagName);

    return \`
        <div class="sim-card-header">
            <div class="sim-tag" title="\${tagName}">\${tagName}</div>
            <button class="btn-download-card" onclick="downloadCard('\${fNum}', this, event)" title="Tải ảnh card để đăng MXH">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
            </button>
        </div>
        <div class="sim-number-container">
            <div class="sim-number">\${hlNum}</div>
        </div>
        <div class="sim-score-container">
            <div class="sim-score-badge">⭐ \${item.ai.score} Điểm</div>
            <div class="sim-reason">\${item.ai.reasonText}</div>
        </div>
        <div class="sim-footer">
            <div class="sim-price-group">
                <div class="sim-price \${isFree ? 'free' : ''}">\${priceText}</div>
                <div class="sim-price-sub">\${isFree ? 'LH nhân viên' : 'cước cam kết / tháng'}</div>
            </div>
            <div class="sim-commit">\${commitText}</div>
        </div>
    \`;
}
