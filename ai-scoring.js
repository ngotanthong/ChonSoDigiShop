// --- AI SCORING ENGINE ---
// Rule-based scoring engine for VNPT DigiShop numbers.
// Score is normalized to the 0-100 range and deduplicated by pattern group.

function analyzeSIM(numStr, monthlyFee = 0) {
    numStr = String(numStr || '').replace(/\D/g, '');
    const fee = Number(monthlyFee) || 0;

    let score = 0;
    const categories = new Set();
    const reasons = [];
    const reasonDetails = [];
    const tagHighlights = {};
    let lastTag = null;
    let highlight = '';

    function primaryFromDetails() {
        const scores = {};
        for (const entry of reasonDetails) {
            scores[entry.tag] = (scores[entry.tag] || 0) + (entry.points || 0);
            if (entry.highlight && !tagHighlights[entry.tag]) tagHighlights[entry.tag] = entry.highlight;
        }
        let bestTag = null;
        let bestScore = -Infinity;
        for (const tag in scores) {
            if (scores[tag] > bestScore) {
                bestScore = scores[tag];
                bestTag = tag;
            }
        }
        const bestHighlight = bestTag && tagHighlights[bestTag] ? tagHighlights[bestTag] : highlight;
        return {
            tag: bestTag,
            score: bestScore === -Infinity ? 0 : bestScore,
            highlight: bestHighlight
        };
    }

    const addReason = (tag, points, category = null, hi = null) => {
        if (!reasons.includes(tag)) reasons.push(tag);
        if (category) categories.add(category);
        score += points;
        reasonDetails.push({ tag, points, category, highlight: hi });
        lastTag = tag;
        if (hi && !tagHighlights[tag]) tagHighlights[tag] = hi;
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
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-2);
        } else if (/(38|78)$/.test(numStr)) {
            addReason('Ông Địa', 14, 'phongthuy');
            highlight = highlight || numStr.slice(-2);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-2);
        }

        // Clean ending improves memory/readability even in phong thủy mode.
        const uniqueDigits = new Set(numStr.split('')).size;
        if (uniqueDigits <= 4) {
            addReason('Dễ Nhớ', 10, 'denho');
        }

        const finalScore = Math.max(0, Math.min(100, Math.round(score)));
        const primary = primaryFromDetails();
        let finalReasons = finalizeReasons(reasons);
        if (primary.tag && finalReasons.includes(primary.tag)) {
            finalReasons = [primary.tag, ...finalReasons.filter(t => t !== primary.tag)];
        }
        return {
            score: finalScore,
            categories: [...categories],
            reasonsArr: finalReasons,
            reasonText: finalReasons.join(' + ') || 'Phong Thủy Khá',
            highlight: primary.highlight || highlight,
            primaryTag: primary.tag,
            primaryScore: primary.score,
            primaryHighlight: primary.highlight || highlight,
            details: reasonDetails.map(d => ({ tag: d.tag, points: d.points }))
        };
    }

    // -------------------------------------------------------------------------
    // Đo độ "nhảy loạn" của số (scattered) + cấu trúc đuôi số.
    // Dùng để hạ điểm các số kiểu 8888 ở đầu/giữa nhưng đuôi lộn xộn.
    // -------------------------------------------------------------------------
    const dirFlipCount = (() => {
        let flips = 0, dir = 0;
        for (let i = 1; i < numStr.length; i++) {
            const d = (parseInt(numStr[i], 10) || 0) - (parseInt(numStr[i - 1], 10) || 0);
            if (d > 0) { if (dir < 0) flips++; dir = 1; }
            else if (d < 0) { if (dir > 0) flips++; dir = -1; }
        }
        return flips;
    })();

    // Đuôi có cấu trúc đẹp: lặp/tam hoa/tứ quý, lộc phát, thần tài, sảnh tiến, số cặp, đầu-đuôi tương phùng.
    const suffixHasPattern =
        /(\d)\1{2,}$/.test(numStr) ||
        /(\d{2})\1$/.test(numStr) ||
        /(\d{3})\1$/.test(numStr) ||
        /(68|86|79|39|38|78)$/.test(numStr) ||
        /(0123|1234|2345|3456|4567|5678|6789|012|123|234|345|456|567|678|789)$/.test(numStr) ||
        /(1357|3579|2468|0246|135|357|579|024|246|468)$/.test(numStr) ||
        /(\d)(\d)\1(\d)$/.test(numStr) ||
        numStr.endsWith(numStr.slice(0, 4));

    // Đuôi nhảy loạn: các chữ số khác nhau và đổi hướng lên/xuống (không đơn điệu).
    const tailIsScattered = (s, n = 5) => {
        const t = s.slice(-n);
        if (t.length < 4) return false;
        if (/(\d)\1/.test(t)) return false;      // có cặp kề nhau thì thường là số đẹp
        const distinct = new Set(t.split('')).size;
        if (distinct < 4) return false;          // xen kẽ / lặp ít digit thường là số đẹp
        let flips = 0, dir = 0;
        for (let i = 1; i < t.length; i++) {
            const d = (parseInt(t[i], 10) || 0) - (parseInt(t[i - 1], 10) || 0);
            if (d > 0) { if (dir < 0) flips++; dir = 1; }
            else if (d < 0) { if (dir > 0) flips++; dir = -1; }
        }
        // 5 số đuôi khác nhau hoàn toàn mà không đơn điệu => loạn;
        // hoặc 4-5 số khác nhau và đổi hướng từ 2 lần trở lên.
        return (distinct >= 5 && flips >= 1) || (distinct >= 4 && flips >= 2);
    };

    // Đuôi xấu = nhảy loạn VÀ không có cấu trúc đuôi đẹp che chắn.
    const tailIsBad = (s) => tailIsScattered(s) && !suffixHasPattern;

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
        const atSuffix = numStr.endsWith(quintupleMatch[0]);
        // Ngũ Quý chỉ đáng giá tối đa khi nằm ở đuôi; ở giữa/đầu + đuôi loạn thì cho điểm thấp.
        addReason('Ngũ Quý', atSuffix ? 58 : (tailIsBad(numStr) ? 16 : 40), 'tuquy');
        highlight = highlight || quintupleMatch[0];
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = quintupleMatch[0];
    } else if (suffixQuadMatch) {
        structuralScoreAwarded = true;
        addReason('Tứ Quý', 52, 'tuquy');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
    } else if (middleQuadMatch) {
        structuralScoreAwarded = true;
        // Tứ Quý ở đầu/giữa số: chỉ đáng giá khi phần đuôi đẹp, nếu đuôi nhảy loạn thì điểm rất thấp.
        const midScattered = tailIsBad(numStr);
        addReason('Tứ Quý', midScattered ? 14 : 44, 'tuquy');
        highlight = highlight || middleQuadMatch[0];
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = middleQuadMatch[0];
    }

    // Tam Hoa: only if no quad-level pattern already owns the suffix.
    if (!suffixQuadMatch && /([5-9])\1{2}$/.test(numStr)) {
        structuralScoreAwarded = true;
        addReason('Tam Hoa', 32, 'tamhoa');
        highlight = highlight || numStr.slice(-3);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-3);
    }

    // Lộc Phát
    if (/(168|868)$/.test(numStr)) {
        addReason('Phát Lộc Phát', 34, 'locphat');
        highlight = highlight || numStr.slice(-3);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-3);
    } else if (/(68|86)$/.test(numStr)) {
        addReason('Lộc Phát', 24, 'locphat');
        highlight = highlight || numStr.slice(-2);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-2);
    }

    // Số Tiến
    if (/(0123|1234|2345|3456|4567|5678|6789)$/.test(numStr)) {
        addReason('Sảnh Tiến Lớn', 34, 'sotien');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
    } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
        addReason('Sảnh Tiến', 18, 'sotien');
        highlight = highlight || numStr.slice(-3);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-3);
    }

    // Taxi / lap. Prefer the highest match within this lap sub-group.
    let taxiAwarded = false;
    if (/(\d{2})\1\1$/.test(numStr)) {
        addReason('Taxi Đẹp', 58, 'solap');
        highlight = highlight || numStr.slice(-6);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
        taxiAwarded = true;
        isLap = true;
    } else if (/(\d{3})\1$/.test(numStr)) {
        addReason('Taxi Đẹp', 54, 'solap');
        highlight = highlight || numStr.slice(-6);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
        taxiAwarded = true;
        isLap = true;
    } else if (/(\d)\1(\d)\2$/.test(numStr) && numStr.slice(-2, -1) !== numStr.slice(-1)) {
        addReason('Lặp Kép', 24, 'solap');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
        isLap = true;
    } else if (/(\d{2})\1$/.test(numStr)) {
        addReason('Lặp Cặp', 18, 'solap');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
        isLap = true;
    }

    // Taxi biến thể: only when main lap pattern was not already awarded.
    if (!taxiAwarded) {
        const taxiVarMatch = numStr.match(/(\d)(79|39|68|86|38|78)(\d)\2$/);
        if (taxiVarMatch && taxiVarMatch[1] !== taxiVarMatch[3]) {
            addReason(`Taxi Đuôi ${taxiVarMatch[2]}`, 42, 'phongthuy');
            addReason(`Taxi Đuôi ${taxiVarMatch[2]}`, 0, 'solap');
            highlight = highlight || numStr.slice(-6);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
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
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = last6g;
        } else if (matchGanhCap) {
            const ganhDiff = Math.abs(parseInt(matchGanhCap[1], 10) - parseInt(matchGanhCap[2], 10));
            const ganhPoint = ganhDiff <= 2 ? 30 : (ganhDiff <= 9 ? 22 : 16);
            addReason('Gánh Cặp', ganhPoint, 'soganh');
            highlight = highlight || numStr.slice(-6);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
        } else if (hasABBA) {
            addReason('Gánh Đảo', 24, 'soganh');
            highlight = highlight || numStr.slice(-4);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
        }
    }

    // -------------------------------------------------------------------------
    // Đuôi đẹp phong thủy
    // -------------------------------------------------------------------------
    if (/(79|39)$/.test(numStr)) {
        addReason('Thần Tài', 22, 'duoidep');
        addReason('Thần Tài', 0, 'phongthuy');
        highlight = highlight || numStr.slice(-2);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-2);
    } else if (/(38|78)$/.test(numStr)) {
        addReason('Ông Địa', 17, 'duoidep');
        addReason('Ông Địa', 0, 'phongthuy');
        highlight = highlight || numStr.slice(-2);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-2);
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
    }
    // (Đã bỏ rule cộng điểm "Không 4, 7" ở chế độ quét.)

    // -------------------------------------------------------------------------
    // Dễ nhớ
    // -------------------------------------------------------------------------
    const uniqueDigitsCount = new Set(numStr.split('')).size;
    if (uniqueDigitsCount <= 3) {
        addReason('Siêu Dễ Nhớ', 30, 'denho');
    } else if (uniqueDigitsCount === 4) {
        addReason('Dễ Nhớ', 14, 'denho');
    }

    // Lặp xen kẽ: một digit cố định ở các vị trí xen kẽ, các digit còn lại TĂNG đều.
    // Chỉ xét 6 số CUỐI (lặp cuối + lặp tăng). Không tính lặp ở giữa và lặp giảm.
    // Ví dụ: 626466 = 6 2 6 4 6 6 (các digit xen kẽ 2-4-6 tăng đều).
    if (numStr.length >= 6) {
        const window6 = numStr.slice(-6);
        if (window6[0] === window6[2] && window6[0] === window6[4]) {
            const even1 = parseInt(window6[1], 10);
            const even2 = parseInt(window6[3], 10);
            const even3 = parseInt(window6[5], 10);
            const step1 = even2 - even1;
            const step2 = even3 - even2;
            // Chỉ nhận bước đều 1-3 đơn vị và phải TĂNG dần (step > 0).
            if (step1 >= 1 && step1 <= 3 && step1 === step2) {
                addReason('Lặp Xen Kẽ', 24, 'solap');
                addReason('Lặp Xen Kẽ', 0, 'denho');
                if (!highlight || highlight.length < 6) highlight = window6;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Tiến chẵn / lẻ
    // -------------------------------------------------------------------------
    if (/(1357|3579)$/.test(numStr)) {
        addReason('Tiến Lẻ Đều', 18, 'sotien');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
    } else if (/(135|357|579)$/.test(numStr)) {
        addReason('Sảnh Tiến Lẻ', 14, 'sotien');
        highlight = highlight || numStr.slice(-3);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-3);
    } else if (/(2468|0246)$/.test(numStr)) {
        addReason('Tiến Chẵn Đều', 18, 'sotien');
        highlight = highlight || numStr.slice(-4);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
    } else if (/(024|246|468)$/.test(numStr)) {
        addReason('Sảnh Tiến Chẵn', 14, 'sotien');
        highlight = highlight || numStr.slice(-3);
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-3);
    }

    // Sảnh giữa: dãy 3-4 số liên tiếp xuất hiện ở giữa số, không chỉ ở đuôi.
    const hasSuffixSodo = reasons.some(r => /^Sảnh|^Sảnh Tiến|^Tiến/.test(r));
    if (!hasSuffixSodo) {
        for (let len = 5; len >= 3; len--) {
            for (let i = 1; i + len <= numStr.length - 1; i++) {
                const win = numStr.slice(i, i + len);
                const asc = win.split('').every((d, idx) => idx === 0 || parseInt(win[idx], 10) - parseInt(win[idx - 1], 10) === 1);
                if (asc) {
                    const point = len === 5 ? 28 : (len === 4 ? 22 : 16);
                    addReason('Sảnh Giữa', point, 'sotien');
                    highlight = highlight || win;
                    if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = win;
                    break;
                }
            }
            if (reasons.includes('Sảnh Giữa')) break;
        }
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
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-8);
        } else if (matchDongDau4 && parseInt(matchDongDau4[3], 10) >= parseInt(matchDongDau4[2], 10)) {
            const diff = parseInt(matchDongDau4[3], 10) - parseInt(matchDongDau4[2], 10);
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', diff > 0 ? 30 : 24, 'denho');
            addReason(diff > 0 ? 'Cụm 4 Tiến' : 'Lặp Cụm 4', 0, 'solap');
            highlight = highlight || numStr.slice(-8);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-8);
        } else if (matchDongDuoi3 && parseInt(matchDongDuoi3[3], 10) >= parseInt(matchDongDuoi3[1], 10)) {
            const diff = parseInt(matchDongDuoi3[3], 10) - parseInt(matchDongDuoi3[1], 10);
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', diff > 0 ? 20 : 16, 'denho');
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
        } else if (matchDongDau3 && parseInt(matchDongDau3[3], 10) >= parseInt(matchDongDau3[2], 10)) {
            const diff = parseInt(matchDongDau3[3], 10) - parseInt(matchDongDau3[2], 10);
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', diff > 0 ? 20 : 16, 'denho');
            addReason(diff > 0 ? 'Lặp Cụm Tiến' : 'Lặp Cụm', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
        } else if (matchDongGiua3 && parseInt(matchDongGiua3[4], 10) >= parseInt(matchDongGiua3[2], 10)) {
            const diff = parseInt(matchDongGiua3[4], 10) - parseInt(matchDongGiua3[2], 10);
            const point = diff === 1 ? 28 : (diff > 1 ? 20 : 14);
            addReason(diff > 0 ? 'Đồng Kẹp Tiến' : 'Đồng Kẹp Bằng', point, 'denho');
            addReason(diff > 0 ? 'Đồng Kẹp Tiến' : 'Đồng Kẹp Bằng', 0, 'solap');
            highlight = highlight || numStr.slice(-6);
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
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
                addReason('Cặp Tiến 3 Bậc', 30, 'captien');
                highlight = highlight || last6;
                if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = last6;
            } else if (diff1 >= 1 && diff1 <= 3 && diff1 === diff2) {
                addReason('Cặp Tiến Nhỏ', diff1 === 1 ? 26 : (diff1 === 2 ? 24 : 22), 'captien');
                highlight = highlight || last6;
                if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = last6;
            }
        }

        const last4 = numStr.slice(-4);
        const pair1 = parseInt(last4.slice(0, 2), 10);
        const pair2 = parseInt(last4.slice(2, 4), 10);
        const pairDiff = pair2 - pair1;
        if (!(pairDiff === 10 && pair1 >= 10 && reasons.includes('Cặp Tiến 3 Bậc')) && pairDiff === 10 && pair1 >= 10) {
            addReason('Cặp Tiến', 14, 'captien');
            highlight = highlight || last4;
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = last4;
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
            if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-6);
            isCap3 = true;
        }
    }
    if (!isCap3) {
        const matchCap2 = numStr.match(/(\d)(\d)\1(\d)$/);
        if (matchCap2 && !/(\d{2})\1$/.test(numStr)) {
            if (parseInt(matchCap2[2], 10) <= parseInt(matchCap2[3], 10)) {
                addReason('Số Cặp', 13, 'denho');
                highlight = highlight || numStr.slice(-4);
                if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = numStr.slice(-4);
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
        if (lastTag && !tagHighlights[lastTag]) tagHighlights[lastTag] = prefix4;
    }

    // -------------------------------------------------------------------------
    // Độ bằng phẳng.
    // -------------------------------------------------------------------------
    const flipCount = dirFlipCount;
    if (flipCount > 5) {
        score -= 8;
    } else if (flipCount <= 2 && uniqueDigitsCount >= 5) {
        score += 5;
    }

    // -------------------------------------------------------------------------
    // Số nhảy loạn / linh tinh: đuôi số không có cấu trúc đẹp mà các chữ số còn
    // đổi hướng lên xuống loạn xạ => không xứng đáng được chấm điểm cao.
    // -------------------------------------------------------------------------
    if (tailIsBad(numStr)) {
        score -= 20;
    }

    // -------------------------------------------------------------------------
    // Rẻ & đẹp: bonus gated by category count, not inflated tag count.
    // -------------------------------------------------------------------------
    // (Rẻ & Đẹp / Rẻ & Siêu Đẹp không còn được chấm điểm hay dùng filter.)

    // -------------------------------------------------------------------------
    // Finalize: deduplicate reasons/tags and cap score.
    // -------------------------------------------------------------------------
    // Boost theo hồ sơ phong thủy khách (rule-based, soft boost)
    // -------------------------------------------------------------------------
    try {
        const cp = (typeof window !== 'undefined') ? window.customerProfile : null;
        if (cp && cp.luckyDigits && cp.luckyDigits.length) {
            let customerBonus = 0;
            for (const d of cp.luckyDigits) {
                if (numStr.includes(String(d))) customerBonus += 4;
            }
            const luckyEnding = cp.goalEndings || [];
            if (luckyEnding.some(e => numStr.endsWith(String(e)))) customerBonus += 16;
            const hasAvoidDigit = cp.avoidDigits && cp.avoidDigits.some(d => numStr.includes(String(d)));
            const luckyNonZero = (cp.luckyDigits || []).map(d => Number(d)).filter(d => d !== 0 && !isNaN(d));
            const luckyPresentCount = luckyNonZero.filter(d => numStr.includes(String(d))).length;
            if (hasAvoidDigit) {
                // Strict: chỉ số không chứa digit kỵ mới được gắn Hợp Khách
                score -= 6;
            }
            const customerTag = `Hợp Khách ${cp.year || ''}`.trim();
            if (!hasAvoidDigit && luckyPresentCount >= 2) {
                addReason(customerTag, Math.min(20, customerBonus), 'phongthuy');
            } else if (hasAvoidDigit) {
                score -= 6;
            }
        }
    } catch (e) {}


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
    const primary = primaryFromDetails();
    if (primary.tag && finalReasons.includes(primary.tag)) {
        finalReasons = [primary.tag, ...finalReasons.filter(t => t !== primary.tag)];
    }

    return {
        score: finalScore,
        categories: [...categories],
        reasonsArr: finalReasons,
        reasonText: finalReasons.join(' + ') || 'Phong Thủy Khá',
        highlight: primary.highlight || highlight,
        primaryTag: primary.tag,
        primaryScore: primary.score,
        primaryHighlight: primary.highlight || highlight,
        details: reasonDetails.map(d => ({ tag: d.tag, points: d.points }))
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

// --- HIỂN THỊ SỐ (nhịp + vùng bôi đỏ) ---
// Dùng CHUNG cho sodep.html (Quét SIM / Phong Thủy / bản in) và index.html
// (Tìm Thủ Công) để nhịp và mark không bao giờ lệch nhau giữa các trang.
//
// numStr        : số 10 chữ số
// matchStr      : đoạn cần bôi đỏ (thường là primaryHighlight của analyzeSIM)
// reasonText    : chuỗi tag, ví dụ "Gánh Đảo + Đồng Kẹp Tiến"
// primaryTag    : tag chính (dùng để chọn nhịp)
// searchParts   : (tuỳ chọn) mảng cụm từ khoá đang tìm, ví dụ ['880'] — các cụm
//                 này được bọc <span class="sh"> (để không vỡ khi đã chèn nhịp)
//
// Trả về HTML: số được chèn dấu cách theo nhịp, đoạn matchStr bọc trong
// <span class="hi"> (CSS tô đỏ ở cả 2 trang). Mark luôn ưu tiên hơn từ khoá.
function highlightHTML(numStr, matchStr, reasonText = '', primaryTag = '', searchParts = null) {
    if (!numStr || numStr.length !== 10) {
        if (!matchStr) return numStr;
        return numStr.replace(matchStr, `<span class="hi">${matchStr}</span>`);
    }

    let dotIndexes = [];

    // Ưu tiên hiển thị cho Lặp Cụm 4 (8 số) và Lặp Cụm (6 số) lên hàng đầu
    const isLapCum4 = matchStr && matchStr.length === 8 && numStr.endsWith(matchStr) && (
        /(\d)(\d{3})(\d)\2$/.test(matchStr) ||
        /(\d{3})(\d)\1(\d)$/.test(matchStr)
    );

    const isLapCum = matchStr && matchStr.length === 6 && numStr.endsWith(matchStr) && (
        /(\d)(\d{2})(\d)\2$/.test(matchStr) ||
        /(\d{2})(\d)\1(\d)$/.test(matchStr) ||
        /(\d)(\d)(\d)\1(\d)\3$/.test(matchStr)
    );

    const isDongKepTien = /Đồng Kẹp Tiến/.test(reasonText || '');
    const isLapCumTien = /Lặp Cụm Tiến/.test(reasonText || '');
    const isLapXenKe = /Lặp Xen Kẽ/.test(reasonText || '');
    const isGanhCap = /Gánh Cặp/.test(reasonText || '');
    const isPrimarySanhGiua = primaryTag === 'Sảnh Giữa';

    // ĐỒNG BỘ NHỊP & MARK: các nhánh theo reasonText bên dưới chỉ đúng khi
    // vùng bôi đỏ (matchStr) chính là 6 số cuối. Nếu mark là nhóm khác
    // (vd Gánh Đảo 4 số "0880") thì bỏ qua, để rơi xuống nhánh theo đúng
    // cấu trúc số -> dấu cách không cắt ngang vùng bôi đỏ.
    const hlIsTail6 = !matchStr || (matchStr.length === 6 && numStr.endsWith(matchStr));

    if (isPrimarySanhGiua) {
        const sanhIdx = matchStr ? numStr.indexOf(matchStr) : -1;
        if (sanhIdx >= 0 && sanhIdx + (matchStr ? matchStr.length : 0) <= numStr.length && sanhIdx !== 0) {
            dotIndexes = [sanhIdx, sanhIdx + (matchStr ? matchStr.length : 0)];
        } else {
            dotIndexes = [4, 7];
        }
    } else if ((isDongKepTien || isLapCumTien || isGanhCap) && hlIsTail6) {
        dotIndexes = [4, 7]; // Nhịp 4-3-3 cho Đồng Kẹp Tiến / Lặp Cụm Tiến / Gánh Cặp
    } else if (isLapXenKe && hlIsTail6) {
        dotIndexes = [4, 6, 8]; // Nhịp 4-2-2-2 cho Lặp Xen Kẽ
    } else if (isLapCum4) {
        dotIndexes = [2, 6]; // Nhịp 2-4-4
    } else if (isLapCum) {
        dotIndexes = [4, 7]; // Nhịp 4-3-3
    } else if (/^(\d{4})\d{2}\1$/.test(numStr)) { // Đầu đuôi tương phùng 4 số (VD: 0886 12 0886)
        dotIndexes = [4, 6]; // Chia nhịp 4-2-4
    } else if (/(\d{3})\1$/.test(numStr) || /(\d)(79|39|68|86|38|78)(\d)\2$/.test(numStr)) { // Taxi 3 cụm ABC ABC hoặc Taxi biến thể (VD: 0812 078 778)
        dotIndexes = [4, 7]; // Chia nhịp 4-3-3
    } else if (/(.)\1{4}$/.test(numStr)) { // Ngũ quý (VD: 091 23 88888)
        dotIndexes = [3, 5];
    } else if (/(.)\1{3}$/.test(numStr)) { // Tứ quý (VD: 091 234 8888)
        dotIndexes = [3, 6];
    } else if (/(.)\1{3}/.test(numStr)) { // Tứ quý / Ngũ quý giữa
        const matchTq = (matchStr && /(.)\1{3}/.test(matchStr)) ? matchStr : numStr.match(/(.)\1{3,}/)[0];
        const idx = numStr.indexOf(matchTq);
        const len = matchTq.length;
        if (idx > 0 && idx + len < 10) {
            dotIndexes = [idx, idx + len];
        } else if (idx === 0) {
            dotIndexes = [len, len + 3];
        } else {
            dotIndexes = [3, 6];
        }
    } else if (/(\d{2})\1\1$/.test(numStr) || /(\d{2})\d{2}\1$/.test(numStr)) { // AB AB AB hoặc AB CD AB (VD: 0912 68 68 68)
        dotIndexes = [4, 6, 8];
    } else if (
        /(\d{2})\1$/.test(numStr) || // Lặp cặp ABAB
        /(\d)\1(\d)\2$/.test(numStr) || // Lặp kép AABB
        /(\d)(\d)\2\1$/.test(numStr) || // Gánh đảo 4 số ABBA
        (() => {
            const m3 = numStr.match(/(\d)(\d)\1(\d)\1(\d)$/);
            if (m3 && parseInt(m3[2]) <= parseInt(m3[3]) && parseInt(m3[3]) <= parseInt(m3[4])) return true;
            const m2 = numStr.match(/(\d)(\d)\1(\d)$/);
            return m2 && parseInt(m2[2]) <= parseInt(m2[3]);
        })() || // Số Cặp (Đồng đầu AB AC tiến hoặc bằng)
        (() => {
            const l4 = numStr.slice(-4);
            const p1 = parseInt(l4.slice(0, 2)), p2 = parseInt(l4.slice(2, 4));
            const diff = p2 - p1;
            return (diff === 10 || diff === 11) && p1 >= 10;
        })() // Cặp Tiến (VD: 6878, 1223)
    ) { // Tất cả các thể loại Số Cặp 4 số ở đuôi
        dotIndexes = [4, 6]; // Chia nhịp 4-2-4 (VD: 0912 34 6868)
    } else if (matchStr && numStr.endsWith(matchStr)) {
        const isSanh = /(012|123|234|345|456|567|678|789|135|357|579|024|246|468|987|876|765|654|543|432|321|210|975|753|531|864|642|420)/.test(matchStr);
        const isGanh3 = matchStr.length === 3 && matchStr[0] === matchStr[2] && matchStr[0] !== matchStr[1]; // ABA
        const isGanh4 = matchStr.length === 4 && matchStr[0] === matchStr[3] && matchStr[1] === matchStr[2] && matchStr[0] !== matchStr[1]; // ABBA
        const isGanhKep = matchStr.length === 6 && matchStr[0] === matchStr[2] && matchStr[0] !== matchStr[1] && matchStr[3] === matchStr[5] && matchStr[3] !== matchStr[4]; // ABA+ABA
        const isCaptien3Bac = matchStr.length === 6 && (() => { const p1 = parseInt(matchStr.slice(0, 2)), p2 = parseInt(matchStr.slice(2, 4)), p3 = parseInt(matchStr.slice(4, 6)); return (p2 - p1) > 0 && (p2 - p1) <= 20 && (p2 - p1) === (p3 - p2); })();

        if (matchStr.length === 3 && isSanh) {
            dotIndexes = [3, 5, 7]; // Sảnh 3 số cuối: nhịp 3-2-2-3
        } else if (matchStr.length === 5 && isSanh) {
            dotIndexes = [3, 5]; // Sảnh 5 số cuối
        } else if (isCaptien3Bac) {
            dotIndexes = [4, 6, 8]; // Cặp Tiến 3 Bậc: nhịp 4-2-2-2 (VD: 0912 50 60 70)
        } else if (isGanhKep) {
            dotIndexes = [4, 7]; // Gánh Kép: nhịp 4-3-3 (VD: 0812 323 262)
        } else if (isGanh3 || isGanh4) {
            dotIndexes = [4, 7]; // Gánh ABA/ABBA: nhịp 4-3-3 (VD: 0911 056 070)
        } else {
            dotIndexes = [3, 6]; // Mặc định 3-3-4
        }
    } else {
        dotIndexes = [3, 6]; // Mặc định 3-3-4 (VD: 091 234 5678)
    }

    const idx = matchStr ? numStr.lastIndexOf(matchStr) : -1;

    // Tập chỉ số thuộc vùng mark (đỏ) và thuộc cụm từ khoá đang tìm
    const markSet = new Set();
    if (idx >= 0) {
        for (let k = idx; k < idx + matchStr.length; k++) markSet.add(k);
    }
    const searchSet = new Set();
    if (searchParts && searchParts.length) {
        searchParts.forEach(part => {
            if (!part) return;
            let from = 0, at;
            while ((at = numStr.indexOf(part, from)) !== -1) {
                for (let k = at; k < at + part.length; k++) searchSet.add(k);
                from = at + 1;
            }
        });
    }

    let html = '';
    let openClass = null;
    for (let i = 0; i < numStr.length; i++) {
        // Mark (.hi, đỏ) ưu tiên hơn cụm từ khoá đang tìm (.sh)
        const cls = markSet.has(i) ? 'hi' : (searchSet.has(i) ? 'sh' : null);

        // Dấu cách nhịp: nằm TRONG span nếu ký tự kế tiếp vẫn cùng vùng (giữ
        // mark liền khối), ngược lại đóng span rồi mới chèn dấu cách ra ngoài.
        if (dotIndexes.includes(i)) {
            if (openClass && cls !== openClass) {
                html += '</span>';
                openClass = null;
            }
            html += ' '; // Dùng dấu cách để dễ nhìn
        }

        if (cls !== openClass) {
            if (openClass) html += '</span>';
            if (cls) html += `<span class="${cls}">`;
            openClass = cls;
        }

        html += numStr[i];
    }
    if (openClass) html += '</span>';
    return html;
}