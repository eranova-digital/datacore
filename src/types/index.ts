// ===== ANAF API Types =====

// ANAF General Info API (V9) Types
export interface AnafGeneralInfoRequest {
    cui: number;
    data: string; // Format: YYYY-MM-DD
}

export interface AnafGeneralInfoResponse {
    cod: number;
    message: string;
    found: AnafBusinessRecord[];
    notFound: number[];
}

export interface AnafBusinessRecord {
    date_generale: {
        cui: string;
        data: string;
        denumire: string;
        adresa: string;
        nrRegCom: string;
        telefon: string;
        fax: string;
        codPostal: string;
        act: string;
        stare_inregistrare: string;
        data_inregistrare: string;
        cod_CAEN: string;
        iban: string;
        statusRO_e_Factura: boolean;
        organFiscalCompetent: string;
        forma_de_proprietate: string;
        forma_organizare: string;
        forma_juridica: string;
    };
    inregistrare_scop_Tva: {
        scpTVA: boolean;
        perioade_TVA?: Array<{
            data_inceput_ScpTVA?: string;
            data_sfarsit_ScpTVA?: string;
            data_anul_imp_ScpTVA?: string;
            mesaj_ScpTVA?: string;
        }>;
    };
    inregistrare_RTVAI: {
        dataInceputTvaInc?: string;
        dataSfarsitTvaInc?: string;
        dataActualizareTvaInc?: string;
        dataPublicareTvaInc?: string;
        tipActTvaInc?: string;
        statusTvaIncasare: boolean;
    };
    stare_inactiv: {
        dataInactivare?: string;
        dataReactivare?: string;
        dataPublicare?: string;
        dataRadiere?: string;
        statusInactivi: boolean;
    };
    inregistrare_SplitTVA: {
        dataInceputSplitTVA?: string;
        dataAnulareSplitTVA?: string;
        statusSplitTVA: boolean;
    };
    adresa_sediu_social: {
        sdenumire_Strada?: string;
        snumar_Strada?: string;
        sdenumire_Localitate?: string;
        scod_Localitate?: string;
        sdenumire_Judet?: string;
        scod_Judet?: string;
        scod_JudetAuto?: string;
        stara?: string;
        sdetalii_Adresa?: string;
        scod_Postal?: string;
    };
    adresa_domiciliu_fiscal: {
        ddenumire_Strada?: string;
        dnumar_Strada?: string;
        ddenumire_Localitate?: string;
        dcod_Localitate?: string;
        ddenumire_Judet?: string;
        dcod_Judet?: string;
        dcod_JudetAuto?: string;
        dtara?: string;
        ddetalii_Adresa?: string;
        dcod_Postal?: string;
    };
}

// ANAF Balance Sheet API Types
export interface AnafBalanceSheetRequest {
    cui: string;
    an: number;
}

export interface AnafBalanceSheetResponse {
    an: number;
    cui: number;
    deni: string;
    caen: number;
    den_caen: string;
    i: AnafBalanceSheetIndicator[];
}

export interface AnafBalanceSheetIndicator {
    indicator: string;
    val_indicator: number;
    val_den_indicator: string;
}

// ===== Internal Types =====

export interface Adresa {
    strada: string;
    numar: string;
    localitate: string;
    judet: string;
    prescurtareJudet: string;
    detaliiAdresa: string;
    codPostal: string;
}

export interface PerioadaTva {
    dataInceput: string;
    dataSfarsit: string;
    motivAnulare: string;
}

export interface TvaIncasare {
    statusTvaIncasare: boolean;
    dataInceput: string;
    dataSfarsit: string;
}

export interface SplitTva {
    statusSplitTva: boolean;
    dataInceput: string;
    dataSfarsit: string;
}

export interface Tva {
    statusTva: boolean;
    perioadeTva: PerioadaTva[];
    tvaIncasare: TvaIncasare;
    splitTva: SplitTva;
}

export interface DCResponse {
    message: string;
    data: unknown | null;
    meta: {
        status: number;
        timestamp: string;
        requestId: string;
    };
}

export interface BusinessRecordDTO {
    cui: string;
    denumire: string;
    nrRegCom?: string;
    telefon?: string;
    stareInregistrare?: string;
    dataInregistrare?: string;
    codCaen?: string;
    denumireCaen?: string; // From balance sheet API
    statusRoEFactura: boolean;
    organFiscalCompetent?: string;
    formaProprietate?: string;
    formaOrganizare?: string;
    formaJuridica?: string;
    tva: Tva;
    adresaSediuSocial: Adresa;
    adresaDomiciliuFiscal: Adresa;
}

export interface BalanceSheetIndicators {
    [key: string]: number;
}

export interface BalanceSheetDTO {
    an: number;
    indicators: BalanceSheetIndicators;
}

export interface BalanceSheetsResponse {
    cui: string;
    denumire: string;
    count: number;
    balanceSheets: BalanceSheetDTO[];
}

// ===== Rate Limiting Types =====

export interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
}
