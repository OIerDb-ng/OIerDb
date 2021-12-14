(() => {
    let OIerDb = Object.create(null),
        first_init = true,
        origin_schools;

    Object.defineProperty(globalThis, 'OIerDb', {
        enumerable: true,
        value: OIerDb,
    });

    Object.defineProperty(OIerDb, 'provinces', {
        enumerable: true,
        value: [
            '安徽',
            '北京',
            '福建',
            '甘肃',
            '广东',
            '广西',
            '贵州',
            '海南',
            '河北',
            '河南',
            '黑龙江',
            '湖北',
            '湖南',
            '吉林',
            '江苏',
            '江西',
            '辽宁',
            '内蒙古',
            '山东',
            '山西',
            '陕西',
            '上海',
            '四川',
            '天津',
            '新疆',
            '浙江',
            '重庆',
            '宁夏',
            '云南',
            '澳门',
            '香港',
            '青海',
            '西藏',
            '台湾',
        ],
    });

    Object.defineProperty(OIerDb, 'award_levels', {
        enumerable: true,
        value: [
            '金牌',
            '银牌',
            '铜牌',
            '一等奖',
            '二等奖',
            '三等奖',
            '国际金牌',
            '国际银牌',
            '国际铜牌',
        ],
    });

    function counter_common(data, n, k) {
        let all = Object.entries(data).sort((x, y) => {
            if (x[1] !== y[1]) return k * (y[1] - x[1]);
            return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
        });
        return typeof n === 'number' ? all.slice(0, n) : all;
    }

    Object.defineProperty(OIerDb, 'Counter', {
        enumerable: true,
        value: class Counter {
            constructor() {
                this.dict = Object.create(null);
            }

            clear() {
                for (let key in this.dict) delete this.dict[key];
            }
            get(key) {
                return this.dict[key] ?? 0;
            }
            least_common(n) {
                return counter_common(this.dict, n, -1);
            }
            length() {
                return Object.keys(this.dict).length;
            }
            most_common(n) {
                return counter_common(this.dict, n, 1);
            }

            update(key, value = 1) {
                if (!(key in this.dict)) this.dict[key] = 0;
                this.dict[key] += value;
            }
        },
    });

    Object.defineProperty(OIerDb, 'Contest', {
        enumerable: true,
        value: class Contest {
            constructor(id, settings) {
                this.id = id;
                for (let setting in settings) this[setting] = settings[setting];
                this.contestants = [];
                this.level_counts = new OIerDb.Counter();
            }

            school_year() {
                return this.year - !this.fall_semester;
            }

            n_contestants() {
                return this.capacity ? this.capacity : this.contestants.length;
            }
        },
    });

    Object.defineProperty(OIerDb, 'School', {
        enumerable: true,
        value: class School {
            constructor(id, settings) {
                this.id = id;
                this.rank = 0;
                [this.name, this.province, this.city, this.score] = settings;
                this.members = [];
                this.records = [];
                this.award_counts = {};
                OIerDb.contests.forEach((contest) => {
                    if (!(contest.type in this.award_counts))
                        this.award_counts[contest.type] = {};
                    if (!(contest.year in this.award_counts[contest.type]))
                        this.award_counts[contest.type][contest.year] =
                            new OIerDb.Counter();
                });
            }
        },
    });

    async function load_from_indexDB() {
        if (
            !(await indexedDB.databases()).find(
                (database) => database.name === 'OIerDb'
            )
        ) {
            throw Error('未找到数据库');
        }
        let db = await new Promise((fulfill, reject) => {
            let request = indexedDB.open('OIerDb');
            request.onerror = reject;
            request.onsuccess = () => fulfill(request.result);
            request.onupgradeneeded = () => reject('数据库版本不符');
        });
        let os = db.transaction('main').objectStore('main'),
            data = {};
        return new Promise((fulfill, reject) => {
            let request = os.get('oiers');
            request.onerror = reject;
            request.onsuccess = () => fulfill(request.result);
        });
    }

    async function save_to_indexDB(data) {
        let db,
            penalty = 0;
        for (;;) {
            db = await new Promise((fulfill, reject) => {
                let request = indexedDB.open('OIerDb');
                request.onerror = reject;
                request.onsuccess = () => fulfill(request.result);
                request.onupgradeneeded = () => {
                    let db = request.result;
                    if (!db.objectStoreNames.contains('main')) {
                        db.createObjectStore('main');
                    }
                };
            });
            if (db.objectStoreNames.contains('main')) break;
            if (++penalty > 10) throw Error('数据库结构无法修复');
            console.log(
                `数据库结构损坏，正在修复中，请稍等直至修复完成的消息 (${penalty}/10) ...`
            );
            await new Promise((fulfill, reject) => {
                let request = indexedDB.deleteDatabase('OIerDb');
                request.onerror = reject;
                request.onsuccess = fulfill;
            });
        }
        if (penalty) console.log('数据库修复完成，准备写入。');
        let os = db.transaction('main', 'readwrite').objectStore('main');
        return new Promise((fulfill, reject) => {
            let request = os.put(data, 'oiers');
            request.onerror = reject;
            request.onsuccess = fulfill;
        });
    }

    function link() {
        const add_contestant = function (contest, record) {
            contest.contestants.push(record);
            contest.level_counts.update(record.level);
        };

        const add_school_record = function (school, record) {
            school.records.push(record);
            school.members.push(record.oier);
            school.award_counts[record.contest.type][
                record.contest.year
            ].update(record.level);
        };

        OIerDb.contests.forEach((contest) => {
            contest.length = 0;
            contest.level_counts.clear();
        });
        OIerDb.schools.forEach((school) => {
            school.members.length = 0;
            school.records.length = 0;
            OIerDb.contests.forEach((contest) =>
                school.award_counts[contest.type][contest.year].clear()
            );
        });
        OIerDb.oiers.forEach((oier) => {
            oier.provinces = Array.from(
                new Set(oier.records.map((record) => record.province))
            );
            oier.records.forEach((record) => {
                record.contest = OIerDb.contests[record.contest];
                record.school = origin_schools[record.school];
                record.oier = oier;
                add_contestant(record.contest, record);
                add_school_record(record.school, record);
            });
        });
        OIerDb.contests.forEach((contest) =>
            contest.contestants.sort((x, y) => x.rank - y.rank)
        );
        OIerDb.schools.forEach(
            (school) => (school.members = Array.from(new Set(school.members)))
        );
        return true;
    }

    function text_to_raw(response) {
        let data = [];
        response.split('\n').forEach((line) => {
            let fields = line.split(',');
            if (fields.length !== 9) return;
            let [
                uid,
                initials,
                name,
                gender,
                enroll_middle,
                oierdb_score,
                ccf_score,
                ccf_level,
                compressed_records,
            ] = fields;
            let records = compressed_records.split('/').map((record) => {
                let [
                    contest,
                    school,
                    score,
                    rank,
                    province_id,
                    award_level_id,
                ] = record.split(':');
                return {
                    contest,
                    school,
                    ...(score !== '' && { score: parseFloat(score) }),
                    rank: parseInt(rank),
                    province:
                        province_id in OIerDb.provinces
                            ? OIerDb.provinces[province_id]
                            : province_id,
                    level:
                        award_level_id in OIerDb.award_levels
                            ? OIerDb.award_levels[award_level_id]
                            : award_level_id,
                };
            });
            oierdb_score = parseFloat(oierdb_score);
            let oier = {
                rank:
                    data.length &&
                    oierdb_score === data[data.length - 1].oierdb_score
                        ? data[data.length - 1].rank
                        : data.length,
                uid: parseInt(uid),
                initials,
                name,
                gender: parseInt(gender),
                enroll_middle: parseInt(enroll_middle),
                oierdb_score,
                ccf_score: parseFloat(ccf_score),
                ccf_level: parseInt(ccf_level),
                records,
            };
            data.push(oier);
        });
        return data;
    }

    OIerDb.init = async function () {
        let support_timing = console.time && console.timeEnd;
        if (support_timing) console.time('预处理时长');
        if (first_init) {
            OIerDb.contests = OIerDb.contests.map(
                (x, id) => new OIerDb.Contest(id, x)
            );
            OIerDb.schools = OIerDb.schools.map(
                (x, id) => new OIerDb.School(id, x)
            );
            origin_schools = OIerDb.schools.concat();
            OIerDb.schools = OIerDb.schools
                .filter((school) => school.name)
                .sort((x, y) => {
                    if (x.score !== y.score) return y.score - x.score;
                    return x.id - y.id;
                });
            OIerDb.schools.forEach(
                (x, id) =>
                    (x.rank =
                        id && x.score === OIerDb.schools[id - 1].score
                            ? OIerDb.schools[id - 1].rank
                            : id)
            );
            first_init = false;
        }
        try {
            if (localStorage.data_sha512 === OIerDb.upstream_sha512) {
                try {
                    OIerDb.oiers = await load_from_indexDB();
                    return link();
                } catch (e1) {
                    console.log(
                        `旧数据受损，原因：${e1.message}，重新读取中...`
                    );
                }
            }
            let response = await (
                await fetch(
                    'https://renbaoshuo.github.io/OIerDb-data-generator/result.txt'
                )
            ).text();
            OIerDb.oiers = text_to_raw(response);
            await save_to_indexDB(OIerDb.oiers);
            if (link()) localStorage.data_sha512 = OIerDb.upstream_sha512;
            return true;
        } catch (e) {
            console.log(`预处理失败，原因：${e.message}`);
        } finally {
            if (support_timing) console.timeEnd('预处理时长');
        }
        return false;
    };

    // syntactic sugars
    OIerDb.ofInitials = function (initials, rank = 0) {
        let all = OIerDb.oiers.filter((oier) => oier.initials === initials);
        if (rank < 0) rank += all.length;
        return all[rank] ?? all;
    };
})();
