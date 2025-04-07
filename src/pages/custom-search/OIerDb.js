/**
 * @typedef {Object} OIRecord
 * @property {OIer} oier
 * @property {Contest} contest
 * @property {string} level
 * @property {string} province
 * @property {number} rank
 * @property {School} school
 * @property {number} score
 * @property {Object} [enroll_middle]
 * @property {boolean} enroll_middle.is_stay_down
 * @property {number} enroll_middle.value
 */

/**
 * @typedef {Object} OIer
 * @property {number} uid
 * @property {string} name
 * @property {string} lowered_name
 * @property {number} ccf_level
 * @property {number} ccf_score
 * @property {number} enroll_middle
 * @property {string} initials
 * @property {number} oierdb_score
 * @property {string[]} provinces
 * @property {number} rank
 * @property {OIRecord[]} records
 * @property {number} gender
 */

/**
 * @typedef {Object} Contest
 * @property {number} id
 * @property {string} name
 * @property {number} year
 * @property {string} type
 * @property {OIRecord[]} contestants
 * @property {boolean} fall_semester
 * @property {number} full_score
 * @property {number} capacity
 * @property {number} length
 * @property {function(): number} school_year
 * @property {function(): number} n_contestants
 */

/**
 * @typedef {Object} School
 * @property {number} id
 * @property {string} name
 * @property {string} province
 * @property {number} score
 * @property {string} city
 * @property {number} rank
 * @property {OIer[]} members
 * @property {OIRecord[]} records
 */

/**
 * @typedef {Object} OIerDb
 * @property {OIer[]} oiers
 * @property {Contest[]} contests
 * @property {School[]} schools
 * @property {number[]} enroll_middle_years
 */
