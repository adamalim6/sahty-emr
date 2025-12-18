
import { Patient, Admission, Appointment, Room, Gender, UserSettings } from '../models/emr';

export class EmrService {
    private patients: Patient[] = [
        {
            id: '1',
            isProvisional: false,
            firstName: 'Ahmed',
            lastName: 'Benali',
            dateOfBirth: '1980-05-12',
            gender: Gender.Male,
            ipp: 'IPP-892301',
            cin: 'AB452109',
            avatar: 'https://picsum.photos/200',
            country: 'Maroc',
            city: 'Casablanca',
            address: '24 Rue des Hôpitaux, Maârif',
            nationality: 'Marocaine',
            isPayant: true
        },
        {
            id: '2',
            isProvisional: false,
            firstName: 'Fatima',
            lastName: 'Zahra',
            dateOfBirth: '1995-11-23',
            gender: Gender.Female,
            ipp: 'IPP-129304',
            cin: 'CD901234',
            avatar: 'https://picsum.photos/201',
            country: 'Maroc',
            city: 'Rabat',
            address: 'Avenue Mohammed V, Appt 4',
            nationality: 'Marocaine',
            isPayant: false,
            insurance: {
                mainOrg: 'CNSS',
                relationship: 'Lui-même',
                registrationNumber: '192837465'
            }
        },
        {
            id: '3',
            isProvisional: false,
            firstName: 'Youssef',
            lastName: 'Idrissi',
            dateOfBirth: '1965-02-10',
            gender: Gender.Male,
            ipp: 'IPP-552019',
            cin: 'EF567890',
            avatar: 'https://picsum.photos/202',
            country: 'Maroc',
            city: 'Marrakech',
            address: 'N° 10 Lotissement Al Massira',
            nationality: 'Marocaine',
            isPayant: true
        },
        {
            id: '4',
            isProvisional: false,
            firstName: 'Khadija',
            lastName: 'Amrani',
            dateOfBirth: '1952-08-30',
            gender: Gender.Female,
            ipp: 'IPP-992381',
            cin: 'GH112233',
            avatar: 'https://picsum.photos/203',
            country: 'Maroc',
            city: 'Tanger',
            address: 'Quartier Marshan, Villa 5',
            nationality: 'Marocaine',
            isPayant: false,
            insurance: {
                mainOrg: 'CNOPS',
                relationship: 'Conjoint',
                registrationNumber: '556677889'
            }
        },
        {
            id: '5',
            isProvisional: false,
            firstName: 'Omar',
            lastName: 'Tazi',
            dateOfBirth: '2010-06-15',
            gender: Gender.Male,
            ipp: 'IPP-221002',
            cin: 'IJ445566',
            avatar: 'https://picsum.photos/204',
            country: 'Maroc',
            city: 'Fès',
            address: 'Quartier Narjiss, Rue 2',
            nationality: 'Marocaine',
            isPayant: true,
            guardian: {
                firstName: 'Karim',
                lastName: 'Tazi',
                phone: '0661223344',
                relationship: 'Père',
                idType: 'CIN',
                idNumber: 'K98231',
                address: 'Quartier Narjiss, Rue 2, Fès',
                habilitation: 'Tuteur légal'
            }
        },
    ];

    private admissions: Admission[] = [
        {
            id: 'a1',
            nda: 'NDA-2023-001',
            patientId: '1',
            reason: 'Douleur thoracique aiguë',
            service: 'Cardiologie',
            admissionDate: '2023-10-25T08:00:00',
            doctorName: 'Dr. S. Alami',
            roomNumber: '101',
            bedLabel: 'Lit A',
            status: 'En cours',
            type: 'Hospitalisation complète'
        },
    ];

    private appointments: Appointment[] = [
        { id: 'ap1', patientId: '2', dateTime: '2025-01-01T09:00:00', service: 'Gynécologie', reason: 'Suivi de grossesse', doctorName: 'Dr. Fassi', status: 'arrived' },
    ];

    private rooms: Room[] = [
        { id: 'r101', number: '101', section: 'Aile Nord', isOccupied: true, patientId: '1', type: 'single' },
    ];

    getAllPatients(): Patient[] {
        return this.patients;
    }

    getPatientById(id: string): Patient | undefined {
        return this.patients.find(p => p.id === id);
    }

    getAllAdmissions(): Admission[] {
        return this.admissions;
    }

    getAllAppointments(): Appointment[] {
        return this.appointments;
    }

    getAllRooms(): Room[] {
        return this.rooms;
    }
}

export const emrService = new EmrService();
