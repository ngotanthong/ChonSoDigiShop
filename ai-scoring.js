// --- AI SCORING ENGINE ---
        function analyzeSIM(numStr, monthlyFee = 0) {
            let score = 0;
            let categories = [];
            let reasons = [];
            let highlight = ''; // Đoạn được highlight

            const isPhongThuyMode = document.getElementById('togglePhongThuy') && document.getElementById('togglePhongThuy').checked;

            if (isPhongThuyMode) {
                // Tính điểm thuần Phong Thuỷ
                
                // 1. Tổng nút (tổng 10 số)
                const sum10 = numStr.split('').reduce((acc, val) => acc + parseInt(val), 0);
                const nut = sum10 % 10;
                if (nut >= 7) { 
                    score += (nut === 9) ? 40 : (nut === 8 ? 30 : 20);
                    reasons.push('Nút ' + nut);
                    categories.push('phongthuy');
                } else {
                    score -= 20; // Nút thấp trừ điểm
                }

                // 2. Tránh 4, 7
                if (!/4/.test(numStr) && !/7/.test(numStr)) {
                    score += 30;
                    reasons.push('Không 4, 7');
                    categories.push('phongthuy');
                } else {
                    score -= 50; // Có 4 hoặc 7 phạt nặng
                }

                // 3. Tránh 49, 53
                if (/49|53/.test(numStr)) {
                    score -= 100; // Phạt rất nặng
                }

                // 4. Đuôi Thần Tài, Ông Địa
                if (/(79|39)$/.test(numStr)) {
                    score += 20;
                    reasons.push('Thần Tài');
                    highlight = numStr.slice(-2);
                } else if (/(38|78)$/.test(numStr)) {
                    score += 15;
                    reasons.push('Ông Địa');
                    highlight = numStr.slice(-2);
                }

                return {
                    score: score,
                    categories: categories,
                    reasonsArr: reasons,
                    reasonText: reasons.join(' + ') || 'Bình thường',
                    highlight: highlight
                };
            }

            // Tứ Quý / Ngũ Quý Giữa
            if (/(.)\1{4}/.test(numStr.slice(0, -1))) { 
                score += 40;
                categories.push('tuquy');
                reasons.push('Ngũ Quý Giữa');
                const match = numStr.match(/(.)\1{4}/);
                highlight = highlight || match[0];
            } else if (/(.)\1{3}/.test(numStr.slice(0, -1))) {
                score += 30;
                categories.push('tuquy');
                reasons.push('Tứ Quý Giữa');
                const match = numStr.match(/(.)\1{3}/);
                highlight = highlight || match[0];
            }

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
                reasons.push('Sảnh Tiến Lớn');
                highlight = highlight || numStr.slice(-4);
            } else if (/(012|123|234|345|456|567|678|789)$/.test(numStr)) {
                score += 15;
                categories.push('sotien');
                reasons.push('Sảnh Tiến');
                highlight = highlight || numStr.slice(-3);
            }

            // 5. Số Lặp Cao Cấp (Taxi, Lặp Kép) & Lặp Thường (ABAB)
            let isLap = false;
            if (/(\d{2})\1\1$/.test(numStr)) { // ABABAB (Taxi 3 cặp)
                score += 60;
                categories.push('solap');
                reasons.push('Taxi Đẹp');
                highlight = highlight || numStr.slice(-6);
                isLap = true;
            } else if (/(\d{3})\1$/.test(numStr)) { // ABCABC (Taxi cụm 3)
                score += 55;
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
                // Kiểm tra Cặp Tiến trước Gánh để không bị override sai
                const _ct6 = numStr.slice(-6);
                const _ct4 = numStr.slice(-4);
                const _p1_6 = parseInt(_ct6.slice(0, 2)), _p2_6 = parseInt(_ct6.slice(2, 4)), _p3_6 = parseInt(_ct6.slice(4, 6));
                const _d1_6 = _p2_6 - _p1_6, _d2_6 = _p3_6 - _p2_6;
                const _p1_4 = parseInt(_ct4.slice(0, 2)), _p2_4 = parseInt(_ct4.slice(2, 4));
                const _d_4 = _p2_4 - _p1_4;
                const isCaptienHere = (_d1_6 > 0 && _d1_6 <= 20 && _d1_6 === _d2_6) ||
                    (_d_4 > 0 && _d_4 <= 20 && _p1_4 >= 10);

                if (!isCaptienHere) {
                    // Kiểm tra Gánh Kép: 6 số cuối gồm 2 cụm ABA liền nhau (VD: 323262)
                    const last6g = numStr.slice(-6);
                    const g1 = last6g.slice(0, 3), g2 = last6g.slice(3, 6);
                    const isABA = (s) => s.length === 3 && s[0] === s[2] && s[0] !== s[1];
                    // Gánh kép có liên kết: chung số giữa (181 282), chung số ngoài (818 828), hoặc xen kẽ (181 818)
                    if (isABA(g1) && isABA(g2) && (g1[1] === g2[1] || g1[0] === g2[0] || (g1[0] === g2[1] && g1[1] === g2[0]))) {
                        score += 25;
                        categories.push('soganh');
                        reasons.push('Gánh Kép');
                        highlight = highlight || last6g;
                    } else {
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
                        } else if (/(\d)(\d)\1$/.test(numStr) && numStr.slice(-1) !== numStr.slice(-2, -1)) { // ABA - hạ điểm
                            score += 8;
                            categories.push('soganh');
                            reasons.push('Gánh');
                            highlight = highlight || numStr.slice(-3);
                        }
                    }
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
                    categories.push('phongthuy'); // Nút 9 đưa vào bộ lọc Phong Thủy
                }
                score += point;
                reasons.push('Nút ' + nut);
            }

            // 8. Trừ điểm số kỵ / Cộng số sạch
            if (/49|53/.test(numStr)) {
                score -= 15;
            } else if (!/4/.test(numStr) && !/7/.test(numStr)) {
                score += 10;
                reasons.push('Không 4, 7');
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
            } else if (/(135|357|579)$/.test(numStr)) {
                score += 15;
                categories.push('sotien');
                reasons.push('Sảnh Tiến Lẻ');
                highlight = highlight || numStr.slice(-3);
            } else if (/(2468|0246)$/.test(numStr)) {
                score += 20;
                categories.push('sotien');
                reasons.push('Tiến Chẵn Đều');
                highlight = highlight || numStr.slice(-4);
            } else if (/(024|246|468)$/.test(numStr)) {
                score += 15;
                categories.push('sotien');
                reasons.push('Sảnh Tiến Chẵn');
                highlight = highlight || numStr.slice(-3);
            }

            // 10.5. Cặp Tiến nâng cao (phát hiện 2-3 cặp 2 số tiến đều)
            {
                // Helper: kiểm tra 2 cặp số cuối có tạo thành cặp tiến không
                const checkPairTien = (str) => {
                    if (str.length < 4) return null;
                    const last4 = str.slice(-4);
                    const p1 = parseInt(last4.slice(0, 2));
                    const p2 = parseInt(last4.slice(2, 4));
                    const diff = p2 - p1;
                    if (diff > 0 && diff <= 20 && diff % 1 === 0) return { pairs: [p1, p2], diff, len: 4 };
                    return null;
                };

                // Kiểm tra 3 cặp đuôi 6 số (mạnh hơn)
                const last6 = numStr.slice(-6);
                let captienFound = false;
                if (last6.length === 6) {
                    const p1 = parseInt(last6.slice(0, 2));
                    const p2 = parseInt(last6.slice(2, 4));
                    const p3 = parseInt(last6.slice(4, 6));
                    const diff1 = p2 - p1;
                    const diff2 = p3 - p2;
                    // Cặp Tiến 3 Bậc đẹp: chỉ chấp nhận diff=10 (chục tròn: 10 20 30) hoặc diff=11 (đôi: 11 22 33)
                    if ((diff1 === 10 || diff1 === 11) && diff1 === diff2) {
                        if (!highlight) {
                            score += 30;
                            categories.push('captien');
                            reasons.push('Cặp Tiến 3 Bậc');
                            highlight = last6;
                            captienFound = true;
                        }
                    }
                }


                // Kiểm tra 2 cặp đuôi 4 số (thông thường)
                if (!captienFound) {
                    const last4 = numStr.slice(-4);
                    const p1 = parseInt(last4.slice(0, 2));
                    const p2 = parseInt(last4.slice(2, 4));
                    const diff = p2 - p1;
                    // Cặp Tiến đẹp: chỉ chấp nhận diff=10 (chục tròn: 20→30) hoặc diff=11 (đôi tăng dần: 22→33, 12→23)
                    // Loại bỏ các cặp ngẫu nhiên như 50→65 (diff=15), 21→33 (diff=12), 81→93 (diff=12)
                    if ((diff === 10 || diff === 11) && p1 >= 10) {
                        if (!highlight) {
                            score += 15;
                            categories.push('captien');
                            reasons.push('Cặp Tiến');
                            highlight = last4;
                        }
                    }
                }
            }

            // Cặp Đồng Đầu (VD: 60 63 68, 71 73)
            if (/(\d)\d\1\d\1\d$/.test(numStr) && !/(\d{2})\1\1$/.test(numStr)) {
                score += 25;
                categories.push('denho');
                reasons.push('Số Cặp');
                highlight = highlight || numStr.slice(-6);
            } else if (/(\d)\d\1\d$/.test(numStr) && !/(\d{2})\1$/.test(numStr)) {
                score += 15;
                categories.push('denho');
                reasons.push('Số Cặp');
                highlight = highlight || numStr.slice(-4);
            }

            // Taxi biến thể (VD: 168 468, 279 179)
            const taxiVarMatch = numStr.match(/(\d)(79|39|68|86|38|78)(\d)\2$/);
            if (taxiVarMatch && taxiVarMatch[1] !== taxiVarMatch[3]) {
                score += 45;
                categories.push('phongthuy');
                categories.push('solap');
                reasons.push(`Taxi Đuôi ${taxiVarMatch[2]}`);
                highlight = highlight || numStr.slice(-6);
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
