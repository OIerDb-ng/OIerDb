/// <reference types="vite/client" />

declare global {
    interface OIerDb {
        init: () => Promise<boolean>;
        oiers: OIer[];
    }

    interface OIer {
        ccf_level: number;
        ccf_score: number;
        enroll_middle: number;
        initials: string;
        name: string;
        oierdb_score: number;
        provinces: string[];
        rank: number;
        records: ContestParticipation[];
        uid: number;
    }

    interface ContestParticipation {
        contest: Contest;
        level: string;
        oier: OIer;
        province: string;
        rank: number;
        school: School;
        score: number;
    }

    interface Contest {
        contestants: ContestParticipation[];
        fall_semester: boolean;
        id: number;
        length: number;
        level_counts: CountSet;
        name: string;
        type: string;
        year: number;
        school_year(): number;
    }

    interface School {
        award_counts: CountSet;
        city: string;
        id: number;
        members: OIer[];
        name: string;
        province: string;
        rank: number;
        records: ContestParticipation[];
        score: number;
    }

    interface CountSet {
        dict: Record<string, number>;
    }

    const OIerDb: OIerDb;

    interface Window {
        appVersion: string;
    }
}

export {};
