import { AnafBusinessRecord, BusinessRecordDTO, Adresa, Tva, PerioadaTva } from "../../types";
import { logger } from "../logger";
import { anafBundler } from "./anafBundler";
import { prisma } from "../prisma";

/**
 * ANAF General Info API Integrator
 * Handles fetching and storing business record data from ANAF
 */

/**
 * Parse "INREGISTRAT din data DD.MM.YYYY" to just "INREGISTRAT"
 */
function parseStareInregistrare(stare: string): string {
    if (!stare) return '';
    // Match "INREGISTRAT", "SUSPENDAT", "RADIAT", etc. (first word)
    const match = stare.match(/^([A-Z]+)/i);
    return match ? match[1] : stare;
}

/**
 * Convert ANAF address format to our Adresa type
 */
function convertAddress(anafAddress: {
    sdenumire_Strada?: string;
    snumar_Strada?: string;
    sdenumire_Localitate?: string;
    sdenumire_Judet?: string;
    scod_JudetAuto?: string;
    sdetalii_Adresa?: string;
    scod_Postal?: string;
} | {
    ddenumire_Strada?: string;
    dnumar_Strada?: string;
    ddenumire_Localitate?: string;
    ddenumire_Judet?: string;
    dcod_JudetAuto?: string;
    ddetalii_Adresa?: string;
    dcod_Postal?: string;
}, prefix: 's' | 'd'): Adresa {
    const key = (field: string) => {
        if (prefix === 's') {
            return (anafAddress as any)[`s${field}`] || '';
        } else {
            return (anafAddress as any)[`d${field}`] || '';
        }
    };

    return {
        strada: key('denumire_Strada'),
        numar: key('numar_Strada'),
        localitate: key('denumire_Localitate'),
        judet: key('denumire_Judet'),
        prescurtareJudet: key('cod_JudetAuto'),
        detaliiAdresa: key('detalii_Adresa'),
        codPostal: key('cod_Postal')
    };
}

/**
 * Transform ANAF API response to internal DTO format
 */
function transformAnafToDTO(anafRecord: AnafBusinessRecord): BusinessRecordDTO {
    // Build TVA periods array
    const perioadeTva: PerioadaTva[] = [];
    if (anafRecord.inregistrare_scop_Tva.perioade_TVA) {
        for (const perioada of anafRecord.inregistrare_scop_Tva.perioade_TVA) {
            perioadeTva.push({
                dataInceput: perioada.data_inceput_ScpTVA || '',
                dataSfarsit: perioada.data_sfarsit_ScpTVA || '',
                motivAnulare: perioada.mesaj_ScpTVA || ''
            });
        }
    }

    // Build TVA object
    const tva: Tva = {
        statusTva: anafRecord.inregistrare_scop_Tva.scpTVA,
        perioadeTva,
        tvaIncasare: {
            statusTvaIncasare: anafRecord.inregistrare_RTVAI.statusTvaIncasare,
            dataInceput: anafRecord.inregistrare_RTVAI.dataInceputTvaInc || '',
            dataSfarsit: anafRecord.inregistrare_RTVAI.dataSfarsitTvaInc || ''
        },
        splitTva: {
            statusSplitTva: anafRecord.inregistrare_SplitTVA.statusSplitTVA,
            dataInceput: anafRecord.inregistrare_SplitTVA.dataInceputSplitTVA || '',
            dataSfarsit: anafRecord.inregistrare_SplitTVA.dataAnulareSplitTVA || ''
        }
    };

    // Convert addresses
    const adresaSediuSocial = convertAddress(anafRecord.adresa_sediu_social, 's');
    const adresaDomiciliuFiscal = convertAddress(anafRecord.adresa_domiciliu_fiscal, 'd');

    return {
        cui: anafRecord.date_generale.cui.toString(),
        denumire: anafRecord.date_generale.denumire,
        nrRegCom: anafRecord.date_generale.nrRegCom || undefined,
        telefon: anafRecord.date_generale.telefon || undefined,
        stareInregistrare: parseStareInregistrare(anafRecord.date_generale.stare_inregistrare),
        dataInregistrare: anafRecord.date_generale.data_inregistrare || undefined,
        codCaen: anafRecord.date_generale.cod_CAEN || undefined,
        statusRoEFactura: anafRecord.date_generale.statusRO_e_Factura,
        organFiscalCompetent: anafRecord.date_generale.organFiscalCompetent || undefined,
        formaProprietate: anafRecord.date_generale.forma_de_proprietate || undefined,
        formaOrganizare: anafRecord.date_generale.forma_organizare || undefined,
        formaJuridica: anafRecord.date_generale.forma_juridica || undefined,
        tva,
        adresaSediuSocial,
        adresaDomiciliuFiscal
    };
}

/**
 * Fetch business record from ANAF API using the bundler
 */
export async function fetchBusinessRecordFromAnaf(cui: number, data: string): Promise<BusinessRecordDTO> {
    try {
        logger.info(`Fetching business record for CUI ${cui} from ANAF`);

        const anafRecord = await anafBundler.addGeneralInfoRequest(cui, data);
        const dto = transformAnafToDTO(anafRecord);

        logger.info(`Successfully fetched business record for CUI ${cui}`);
        return dto;
    } catch (error) {
        logger.error(`Error fetching business record for CUI ${cui}: ${error}`);
        throw error;
    }
}

/**
 * Save business record to database
 */
export async function saveBusinessRecordToDatabase(dto: BusinessRecordDTO): Promise<void> {
    try {
        // Ensure CUI is a string
        const cui = dto.cui.toString();

        await prisma.businessRecord.upsert({
            where: { cui },
            update: {
                denumire: dto.denumire,
                nrRegCom: dto.nrRegCom,
                telefon: dto.telefon,
                stareInregistrare: dto.stareInregistrare,
                dataInregistrare: dto.dataInregistrare,
                codCaen: dto.codCaen,
                denumireCaen: dto.denumireCaen,
                statusRoEFactura: dto.statusRoEFactura,
                organFiscalCompetent: dto.organFiscalCompetent,
                formaProprietate: dto.formaProprietate,
                formaOrganizare: dto.formaOrganizare,
                formaJuridica: dto.formaJuridica,
                tva: JSON.stringify(dto.tva),
                adresaSediuSocial: JSON.stringify(dto.adresaSediuSocial),
                adresaDomiciliuFiscal: JSON.stringify(dto.adresaDomiciliuFiscal)
            },
            create: {
                cui,
                denumire: dto.denumire,
                nrRegCom: dto.nrRegCom,
                telefon: dto.telefon,
                stareInregistrare: dto.stareInregistrare,
                dataInregistrare: dto.dataInregistrare,
                codCaen: dto.codCaen,
                denumireCaen: dto.denumireCaen,
                statusRoEFactura: dto.statusRoEFactura,
                organFiscalCompetent: dto.organFiscalCompetent,
                formaProprietate: dto.formaProprietate,
                formaOrganizare: dto.formaOrganizare,
                formaJuridica: dto.formaJuridica,
                tva: JSON.stringify(dto.tva),
                adresaSediuSocial: JSON.stringify(dto.adresaSediuSocial),
                adresaDomiciliuFiscal: JSON.stringify(dto.adresaDomiciliuFiscal)
            }
        });

        logger.info(`Successfully saved business record for CUI ${dto.cui} to database`);
    } catch (error) {
        logger.error(`Error saving business record for CUI ${dto.cui}: ${error}`);
        throw error;
    }
}

/**
 * Get business record from database
 */
export async function getBusinessRecordFromDatabase(cui: string): Promise<BusinessRecordDTO | null> {
    try {
        const record = await prisma.businessRecord.findUnique({
            where: { cui }
        });

        if (!record) return null;

        return {
            cui: record.cui,
            denumire: record.denumire,
            nrRegCom: record.nrRegCom || undefined,
            telefon: record.telefon || undefined,
            stareInregistrare: record.stareInregistrare || undefined,
            dataInregistrare: record.dataInregistrare || undefined,
            codCaen: record.codCaen || undefined,
            denumireCaen: record.denumireCaen || undefined,
            statusRoEFactura: record.statusRoEFactura,
            organFiscalCompetent: record.organFiscalCompetent || undefined,
            formaProprietate: record.formaProprietate || undefined,
            formaOrganizare: record.formaOrganizare || undefined,
            formaJuridica: record.formaJuridica || undefined,
            tva: JSON.parse(record.tva),
            adresaSediuSocial: JSON.parse(record.adresaSediuSocial),
            adresaDomiciliuFiscal: JSON.parse(record.adresaDomiciliuFiscal)
        };
    } catch (error) {
        logger.error(`Error getting business record for CUI ${cui}: ${error}`);
        throw error;
    }
}

/**
 * Update only the denumireCaen field in the business record
 */
export async function updateDenumireCaen(cui: string, denumireCaen: string): Promise<void> {
    try {
        await prisma.businessRecord.update({
            where: { cui },
            data: { denumireCaen }
        });
        logger.info(`Updated denumireCaen for CUI ${cui}`);
    } catch (error) {
        logger.error(`Error updating denumireCaen for CUI ${cui}: ${error}`);
        throw error;
    }
}
