// --- AI SCORING ENGINE ---
// Rule-based scoring engine for VNPT DigiShop numbers.
// Score is normalized to the 0-100 range and deduplicated by pattern group.

function analyzeSIM(numStr, monthlyFee = 0) {
    numStr = String(numStr || '').replace(/\D/g, '');
    const fee = Number(monthlyFee) || 0;

    let score = 0;
    const categories = new Set();
    const reasons = [];
    let highlight = '';

    const addReason = (tag, points, category = null) => {
        if (!reasons.includes(tag)) reasons.push(tag);
        if (category) categories.add(category);
        score += points;
    };

    // -------------------------------------------------------------------------
    // Phong thủy mode
    // -------------------------------------------------------------------------
    const isPhongThuyMode = typeof document !== 'undefined' &&
        document.getElementById('togglePhongThuy') &&
        document.getElementById('togglePhongThuy').checked;

    if (isPhongThuyMode) {
        const sum10 = numStr.split('').reduce((acc, val) => acc + (parseInt(val, 10) || 0), 0);
        const nut = sum10 % 10;

        if (nut >= 7) {
            addReason('Nút ' + nut, nut === 9 ? 32 : (nut === 8 ? 24 : 16), 'phongthuy');
        } else {
            score -= 12;
        }

        if (!/4/.test(numStr) && !/7/.test(numStr)) {
            addReason('Không 4, 7', 22, 'phongthuy');
        } else {
            score -= 28;
        }

        if (/49|53/.test(numStr)) {
            score -= 40;
        }

        if (/(79|39)$/.test(numStr)) {
            addReason('Thần Tài', 18, 'phongthuy');
            highlight = highlight || numStr.slice(-2);
        } else if (/(38|78)$/.test(numStr)) {
            addReason('Ông Địa', 14, 'phongthuy');
            highlight = highlight || numStr.slice(-2);
        }

        // Clean ending improves memory/readability even in phong thủy mode.
        const uniqueDigits = new Set(numStr.split('')).size;
        if (uniqueDigits <= 4) {
            addReason('Dễ Nhớ', 10, 'denho');
        }

        const finalScore = Math.max(0, Math.min(100, Math.round(score)));
        const finalReasons = finalizeReasons(reasons);
        return {
            score: finalScore,
            categories: [...categories],
            reasonsArr: finalReasons,
            reasonText: finalReasons.join(' + ') || 'Phong Thủy Khá',
            highlight: highlight
        };
    }

    // -------------------------------------------------------------------------
    // Structural pattern group: only one dominant pattern is scored here.
    // -------------------------------------------------------------------------
    let structuralScoreAwarded = false;
    let isLap = false;

    // Ngũ Quý / Tứ Quý
    const quintupleMatch = numStr.match(/(.)\1{4}/);
    const suffixQuadMatch = numStr.match(/(.)\1{3}$/);
    const middleQuadMatch = !suffixQuadMatch ? numStr.match(/(.)\1{3}/) : null;

    if (quintupleMatch) {
        structuralScoreAwarded = true;
        addReason('Ngũ Quý', 58, 'tuquy');
        highlight = highlight || quintupleMatch[0];
    } else if (suffixQuadMatch) {
        structuralScoreAwarded = true;
        addReason('Tứ Quý', 52, 'tuquy');
        highlight = highlight || numStr.slice(-4);
    } else if (middleQuadMatch) {
        structuralScoreAwarded = true;
        addReason('Tứ Quý', 44, 'tuquy');
        highlight = highlight || middleQuadMatch[0];
    }

    // Tam Hoa: only if no quad-level pattern already owns the suffix.
    if (!suffixQuadMatch && /([5-9])\1{2}$/.test(numStr)) {
        structuralScoreAwarded = true;
        addReason('Tam Hoa', 32, 'tamhoa');
        highlight = highlight || numStr.slice(-3);
    }

    // Lộc Phát
    if (/(168|868)$/.test(numStr)) {
        addReason('Phát Lộc Phát', 34, 'locphat');
        highlight = highlight || numStr.slice(-3);
    } else if (/(68|86)$/.test(numStr)) {
        addReason('Lộc Phát', 24, 'locphat');
        highlight = highlight || numStr.slice(-2);
    }

    // Số Tiến
    if (/(0123|1234|2345|3456|4567|5678|6789)$/.test(numStr)) {
        addReason('Sảnh Tiến Lớn', 34, 'sotien');
        highlight = highlight || numStr.slice(-4);
    } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
        addReason('Sảnh Tiến', 18, 'sotien');
        highlight = highlight || numStr.slice(-3);
    }

    // Taxi / lap. Prefer the highest match within this lap sub-group.
    let taxiAwarded = false;
    if (/(\d{2})\1\1$/.test(numStr)) {
        addReason('Taxi Đẹp', 58, 'solap');
        highlight = highlight || numStr.slice(-6);
        taxiAwarded = true;
        isLap = true;
    } else if (/(\d{3})\1$/.test(numStr)) {
        addReason('Taxi Đẹp', 54, 'solap');
        highlight = highlight || numStr.slice(-6);
        taxiAwarded = true;
        isLap = true;
    } else if (/(\d)\1(\d)\2$/.test(numStr) && numStr.slice(-2, -1) !== numStr.slice(-1)) {
        addReason('Lặp Kép', 24, 'solap');
        highlight = highlight || numStr.slice(-4);
        isLap = true;
    } else if (/(\d{2})\1$/.test(numStr)) {
        addReason('Lặp Cặp', 18, 'solap');
        highlight = highlight || numStr.slice(-4);
        isLap = true;
    }

    // Taxi biến thể: only when main lap pattern was not already awarded.
    if (!taxiAwarded) {
        const taxiVarMatch = numStr.match(/(\d)(79|39|68|86|38|78)(\d)\2$/);
        if (taxiVarMatch && taxiVarMatch[1] !== taxiVarMatch[3]) {
            addReason(`Taxi Đuôi ${taxiVarMatch[2]}`, 42, 'phongthuy');
            addReason(`Taxi Đuôi ${taxiVarMatch[2]}`, 0, 'solap');
            highlight = highlight || numStr.slice(-6);
            isLap = true;
        }
    }

    // -------------------------------------------------------------------------
    // Gánh / đảo group
    // -------------------------------------------------------------------------
    if (!isLap) {
        const last6g = numStr.slice(-6);
        const g1 = last6g.slice(0, 3);
        const g2 = last6g.slice(3, 6);
        const isABA = (s) => s.length === 3 && s[0] === s[2] && s[0] !== s[1];

        const matchGanhCap = numStr.match(/(\d{2})(\d{2})\1$/);
        const hasABBA = /(\d)(\d)\2\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1);
        const hasABA = /(\d)(\d)\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1);

        if (isABA(g1) && isABA(g2) &&
            (g1[1] === g2[1] || g1[0] === g2[0] || (g1[0] === g2[1] && g1[1] === g2[0]))) {
            addReason('Gánh Kép', 26, 'soganh');
            highlight = highlight || last6g;
        } else if (matchGanhCap && Math.abs(parseInt(matchGanhCap[1], 10) - parseInt(matchGanhCap[2], 10)) <= 2) {
            addReason('Gánh Cặp', 30, 'soganh');
            highlight = highlight || numStr.slice(-6);
        } else if (hasABBA) {
            addReason('Gánh Đảo', 24, 'soganh');
            highlight = highlight || numStr.slice(-4);
        } else if (hasABA) {
            addReason('Gánh', 8, 'soganh');
            highlight = highlight || numStr.slice(-3);
        }
    }

    // -------------------------------------------------------------------------
    // Đuôi đẹp phong thủy
    // -------------------------------------------------------------------------
    if (/(79|39)$/.test(numStr)) {
        addReason('Thần Tài', 22, 'duoidep');
        addReason('Thần Tài', 0, 'phongthuy');
        highlight = highlight || numStr.slice(-2);
    } else if (/(38|78)$/.test(numStr)) {
        addReason('Ông Địa', 17, 'duoidep');
        addReason('Ông Địa', 0, 'phongthuy');
        highlight = highlight || numStr.slice(-2);
    }

    // -------------------------------------------------------------------------
    // Tổng nút + số sạch
    // -------------------------------------------------------------------------
    const sum10 = numStr.split('').reduce((acc, val) => acc + (parseInt(val, 10) || 0), 0);
    const nut = sum10 % 10;
    if (nut >= 7) {
        addReason('Nút ' + nut, nut === 9 ? 12 : (nut === 8 ? 8 : 5), 'phongthuy');
    }
    if (/49|53/.test(numStr)) {
        score -= 15;
    } else if (!/4/.test(numStr) && !/7/.test(numStr)) {
        addReason('Không 4, 7', 10, 'phongthuy');
    }

    // -------------------------------------------------------------------------
    // Dễ nhớ
    // -------------------------------------------------------------------------
    const uniqueDigitsCount = new Set(numStr.split('')).size;
    if (uniqueDigitsCount <= 3) {
        addReason('Siêu Dễ Nhớ', 30, 'denho');
    } else if (uniqueDigitsCount === 4) {
        addReason('Dễ Nhớ', 14, 'denho');
    }

    // -------------------------------------------------------------------------
    // Tiến chẵn / lẻ
    // -------------------------------------------------------------------------
    if (/(1357|3579)$/.test(numStr)) {
        addReason('Tiến Lẻ Đều', 18, 'sotien');
        highlight = highlight || numStr.slice(-4);
    } else if (/(135|357|579)$/.test(numStr)) {
        addReason('Sảnh Tiến Lẻ', 14, 'sotien');
        highlight = highlight || numStr.slice(-3);
    } else if (/(2468|0246)$/.test(numStr)) {
        addReason('Tiến Chẵn Đều', 18, 'sotien');
        highlight = highlight || numStr.slice(-4);
    } else if (/(024|246|468)$/.test(numStr)) {
        addReason('Sảnh Tiến Chẵn', 14, 'sotien');
        highlight = highlight || numStr.slice(-3);
    }

    // -------------------------------------------------------------------------
    // Lặp cụm (cluster repetition). Only add when no direct lap pattern dominated.
    // -------------------------------------------------------------------------
    if (!isLap) {
        const matchDongDuoi4 = numStr.match(/(\d)(\d{3})(\d)\2$/);
        const matchDongDau4 = numStr.match(/(\d{3})(\d)\1(\d)$/);
        const matchDongDuoi3 = numStr.match(/(\d)(\d{2})(\d)\2$/);
        const matchDongDau3 = numStr.match(/(\d{2})(\d)\1(\d)$/);
        const matchDongGiua3 = numStr.match(/(\d)(\d)(\d)\1(\d)\3$/);

        if (matchDongDuoi4 && parseInt(matchDongDuoi4[3], 10) >= parseInt(matchDongDuoi4[1], 10)) {
            const diff = parseInt(matchDongDuoi4[3], 10) - parseInt(matchDongDuoi4[1], 10);
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', diff > 0 ? 30 : 24, 'denho');
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', 0, 'solap');
            highlight = highlight || numStr.slice(-8);
        } else if (matchDongDau4 && parseInt(matchDongDau4[3], 10) >= parseInt(matchDongDau4[2], 10)) {
            const diff = parseInt(matchDongDau4[3], 10) - parseInt(matchDongDau4[2], 10);
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', diff > 0 ? 30 : 24, 'denho');
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', 0, 'solap');
            highlight = highlight || numStr.slice(-8);
        } else if (matchDongDuoi3 && parseInt(matchDongDuoi3[3], 10) >= parseInt(matchDongDuoi3[1], 10)) {
            const diff = parseInt(matchDongDuoi3[3], 10) - parseInt(matchDongDuoi3[1], 10);
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', diff > 0 ? 20 : 16, 'denho');
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
        } else if (matchDongDau3 && parseInt(matchDongDau3[3], 10) >= parseInt(matchDongDau3[2], 10)) {
            const diff = parseInt(matchDongDau3[3], 10) - parseInt(matchDongDau3[2], 10);
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', diff > 0 ? 20 : 16, 'denho');
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
        } else if (matchDongGiua3 && parseInt(matchDongGiua3[4], 10) >= parseInt(matchDongGiua3[2], 10)) {
            const diff = parseInt(matchDongGiua3[4], 10) - parseInt(matchDongGiua3[2], 10);
            const point = diff === 1 ? 28 : (diff > 1 ? 20 : 14);
            addReason(diff > 0 ? 'Đồng Kẹp Tiến' : 'Đồng Kẹp Bằng', point, 'denho');
            addReason(diff > 0 ? 'Đồng Kẹp Tiến' : 'Đồng Kẹp Bằng', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
        }
    }

    // -------------------------------------------------------------------------
    // Cặp tiến nâng cao. Only when it did not already become a lap pattern.
    // -------------------------------------------------------------------------
    if (!isLap) {
        const last6 = numStr.slice(-6);
        if (last6.length === 6) {
            const p1 = parseInt(last6.slice(0, 2), 10);
            const p2 = parseInt(last6.slice(2, 4), 10);
            const p3 = parseInt(last6.slice(4, 6), 10);
            const diff1 = p2 - p1;
            const diff2 = p3 - p2;
            if (diff1 === 10 && diff1 === diff2) {
                addReason('Cặp Tiến 3 Bậc', 28, 'captien');
                highlight = highlight || last6;
            }
        }

        const last4 = numStr.slice(-4);
        const pair1 = parseInt(last4.slice(0, 2), 10);
        const pair2 = parseInt(last4.slice(2, 4), 10);
        const pairDiff = pair2 - pair1;
        if (!(pairDiff === 10 && pair1 >= 10 && reasons.includes('Cặp Tiến 3 Bậc')) && pairDiff === 10 && pair1 >= 10) {
            addReason('Cặp Tiến', 14, 'captien');
            highlight = highlight || last4;
        }
    }

    // -------------------------------------------------------------------------
    // Cặp đồng đầu / trailing pair.
    // -------------------------------------------------------------------------
    const matchCap3 = numStr.match(/(\d)(\d)\1(\d)\1(\d)$/);
    let isCap3 = false;
    if (matchCap3 && !/(\d{2})\1\1$/.test(numStr)) {
        if (parseInt(matchCap3[2], 10) <= parseInt(matchCap3[3], 10) &&
            parseInt(matchCap3[3], 10) <= parseInt(matchCap3[4], 10)) {
            addReason('Số Cặp', 20, 'denho');
            highlight = highlight || numStr.slice(-6);
            isCap3 = true;
        }
    }
    if (!isCap3) {
        const matchCap2 = numStr.match(/(\d)(\d)\1(\d)$/);
        if (matchCap2 && !/(\d{2})\1$/.test(numStr)) {
            if (parseInt(matchCap2[2], 10) <= parseInt(matchCap2[3], 10)) {
                addReason('Số Cặp', 13, 'denho');
                highlight = highlight || numStr.slice(-4);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Đầu đuôi tương phùng
    // -------------------------------------------------------------------------
    const prefix4 = numStr.slice(0, 4);
    if (numStr.endsWith(prefix4)) {
        addReason('Đầu Đuôi Tương Phùng', 24, 'denho');
        highlight = highlight || prefix4;
    }

    // -------------------------------------------------------------------------
    // Độ bằng phẳng.
    // -------------------------------------------------------------------------
    let flipCount = 0;
    let lastDirection = 0;
    for (let i = 1; i < numStr.length; i++) {
        const diff = parseInt(numStr[i], 10) - parseInt(numStr[i - 1], 10);
        if (diff > 0) {
            if (lastDirection === -1) flipCount++;
            lastDirection = 1;
        } else if (diff < 0) {
            if (lastDirection === 1) flipCount++;
            lastDirection = -1;
        }
    }
    if (flipCount > 5) {
        score -= 8;
    } else if (flipCount <= 2 && uniqueDigitsCount >= 5) {
        score += 5;
    }

    // -------------------------------------------------------------------------
    // Rẻ & đẹp: bonus gated by category count, not inflated tag count.
    // -------------------------------------------------------------------------
    const richCategoryCount = categories.size;
    if (fee <= 100000 && richCategoryCount >= 4) {
        addReason('Rẻ & Siêu Đẹp', 18, 'phongthuy');
    } else if (fee <= 100000 && richCategoryCount === 3) {
        addReason('Rẻ & Đẹp', 10, 'phongthuy');
    }

    // -------------------------------------------------------------------------
    // Finalize: deduplicate reasons/tags and cap score.
    // -------------------------------------------------------------------------
    const lowPriorityTags = ['Nút 7', 'Nút 8', 'Nút 9', 'Rẻ & Đẹp', 'Rẻ & Siêu Đẹp', 'Dễ Nhớ', 'Siêu Dễ Nhớ', 'Không 4, 7', 'Gánh'];
    let finalReasons = Array.from(new Set(reasons));

    if (finalReasons.length > 4) {
        const keepTags = [];
        const dropTags = [];
        for (const tag of finalReasons) {
            if (lowPriorityTags.includes(tag)) dropTags.push(tag);
            else keepTags.push(tag);
        }
        if (keepTags.length >= 4) {
            finalReasons = keepTags.slice(0, 4);
        } else {
            const needed = 4 - keepTags.length;
            finalReasons = keepTags.concat(dropTags.slice(0, needed));
        }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
        score: finalScore,
        categories: [...categories],
        reasonsArr: finalReasons,
        reasonText: finalReasons.join(' + ') || 'Phong Thủy Khá',
        highlight: highlight
    };
}

function finalizeReasons(reasons) {
    const unique = Array.from(new Set(reasons));
    if (unique.length <= 4) return unique;
    const lowPriorityTags = ['Nút 7', 'Nút 8', 'Nút 9', 'Rẻ & Đẹp', 'Rẻ & Siêu Đẹp', 'Dễ Nhớ', 'Siêu Dễ Nhớ', 'Không 4, 7', 'Gánh'];
    const keepTags = unique.filter(tag => !lowPriorityTags.includes(tag));
    const dropTags = unique.filter(tag => lowPriorityTags.includes(tag));
    if (keepTags.length >= 4) return keepTags.slice(0, 4);
    return keepTags.concat(dropTags.slice(0, 4 - keepTags.length));
}