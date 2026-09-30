// In-memory fallback dataset for seamless Vercel serverless preview
// when MongoDB Atlas connection string is not yet configured.

const mockHalls = [
  {
    _id: '665000000000000000000001',
    name: 'Block-2 Seminar Hall',
    code: 'BLOCK-2',
    block: 'Block-2',
    capacity: 250,
    coordinator: '665000000000000000000101',
    coordinatorName: 'Dr S N Tirumala Rao',
    coordinatorPhone: '8247394015',
    coordinatorEmail: 'csehod@nrtec.in',
    location: 'Ground Floor, Block-2 (Main Admin & CSE Wing)',
    description: 'Air-conditioned seminar hall equipped with high-lumen laser projector, motorized screen, JBL surround audio, podium mic, and wireless lapel mics.',
    facilities: ['Centralized AC', 'High-Lumen Projector', 'JBL Sound System', 'Smart Podium & Mic', 'High-Speed Wi-Fi', 'Motorized Screen']
  },
  {
    _id: '665000000000000000000002',
    name: 'Block-3 Seminar Hall',
    code: 'BLOCK-3',
    block: 'Block-3',
    capacity: 320,
    coordinator: '665000000000000000000102',
    coordinatorName: 'Dr. V. VENKATA RAO',
    coordinatorPhone: '9441127485',
    coordinatorEmail: 'ecehod@nrtec.in',
    location: 'First Floor, Block-3 (ECE & EEE Wing)',
    description: 'Modern digital hall with interactive LED video wall, video conferencing setup, tiered executive cushioned seating, and advanced acoustic design.',
    facilities: ['Centralized AC', 'Interactive LED Video Wall', 'Polycom Video Conferencing', 'Acoustic Wall Paneling', 'Dual Wireless Mics', 'Recording Camera']
  },
  {
    _id: '665000000000000000000003',
    name: 'Block-4 Seminar Hall',
    code: 'BLOCK-4',
    block: 'Block-4',
    capacity: 450,
    coordinator: '665000000000000000000103',
    coordinatorName: 'Dr. D.Suneel',
    coordinatorPhone: '9441127485',
    coordinatorEmail: 'viceprincipal@nrtec.in',
    location: 'Second Floor, Block-4 (Mechanical & Civil Wing)',
    description: 'Grand auditorium-style seminar hall with elevated stage, large seating capacity, theatrical stage lighting, green room, and powerful digital public address system.',
    facilities: ['Centralized AC', 'Stage & Theatrical Lighting', 'Dual Projectors', 'Auditorium Seating', 'Digital Audio Mixer', 'Backstage Facility']
  }
];

const mockUsers = [
  {
    _id: '665000000000000000000101',
    name: 'Dr S N Tirumala Rao',
    email: 'csehod@nrtec.in',
    role: 'HOD',
    roles: ['HOD', 'COORDINATOR'],
    department: 'Computer Science & Engineering (CSE)',
    designation: 'Professor & HOD (CSE) | Block-2 Seminar Hall Coordinator',
    assignedHall: mockHalls[0],
    phone: '8247394015',
    landline: '08647-239912'
  },
  {
    _id: '665000000000000000000102',
    name: 'Dr. V. VENKATA RAO',
    email: 'ecehod@nrtec.in',
    role: 'HOD',
    roles: ['HOD', 'COORDINATOR'],
    department: 'Electronics & Communication Engineering (ECE)',
    designation: 'Professor & HOD (ECE) | Block-3 Seminar Hall Coordinator',
    assignedHall: mockHalls[1],
    phone: '9441127485',
    landline: '08647-239914'
  },
  {
    _id: '665000000000000000000103',
    name: 'Dr. D.Suneel',
    email: 'viceprincipal@nrtec.in',
    role: 'COORDINATOR',
    roles: ['COORDINATOR'],
    department: 'Mechanical Engineering & Administration',
    designation: 'Vice Principal & Coordinator - Block-4 Seminar Hall',
    assignedHall: mockHalls[2],
    phone: '9441127485'
  },
  {
    _id: '665000000000000000000104',
    name: 'Dr. SHAIK MAHAMMAD SHAREEF',
    email: 'hodeee@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Electrical & Electronics Engineering (EEE)',
    designation: 'Professor & Head of Department - EEE',
    phone: '+91 8647 239901'
  },
  {
    _id: '665000000000000000000105',
    name: 'Dr. V.V.A.S. Lakshmi',
    email: 'aicsdshod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'CSE - Emerging Technologies [CSE(ET)]',
    designation: 'Professor & Head of Department - CSE(ET)',
    phone: '+91 8647 239904'
  },
  {
    _id: '665000000000000000000106',
    name: 'Dr. P. Naga Sowjanya',
    email: 'civilhod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Civil Engineering (CIVIL)',
    designation: 'Professor & Head of Department - Civil Engineering',
    phone: '+91 8647 239900'
  },
  {
    _id: '665000000000000000000107',
    name: 'Dr. B. Venkata Siva',
    email: 'mechhod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Mechanical Engineering (MECH)',
    designation: 'Professor & Head of Department - MECH',
    phone: '9692464540'
  },
  {
    _id: '665000000000000000000108',
    name: 'Dr. B. Jhansi Rani',
    email: 'ithod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Information Technology (IT)',
    designation: 'Professor & Head of Department - IT',
    phone: '+91 8647 239903'
  },
  {
    _id: '665000000000000000000109',
    name: 'Dr. S. Sivaram Prasad',
    email: 'mbahod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Management Studies (MBA & MCA)',
    designation: 'Professor & Head of Department - MBA & MCA',
    phone: '+91 8647 239905'
  },
  {
    _id: '665000000000000000000110',
    name: 'Dr. K. P. Lakshmi',
    email: 'bshhod@nrtec.in',
    role: 'HOD',
    roles: ['HOD'],
    department: 'Basic Sciences & Humanities (BS&H)',
    designation: 'Professor & Head of Department - BS&H',
    phone: '+91 8647 239906'
  },
  {
    _id: '665000000000000000000111',
    name: 'Sri K. Srinivasa Rao',
    email: 'ao@nrtec.in',
    role: 'AO',
    roles: ['AO'],
    department: 'Administrative Office',
    designation: 'Administrative Officer (AO)',
    phone: '+91 94400 99887'
  }
];

const todayStr = new Date().toISOString().split('T')[0];

let mockBookings = [
  {
    _id: '665000000000000000000201',
    bookingId: 'NEC-SH-2026-1001',
    hall: mockHalls[0]._id,
    hallName: mockHalls[0].name,
    hod: mockUsers[0]._id,
    hodName: mockUsers[0].name,
    department: mockUsers[0].department,
    eventName: 'National Workshop on Generative AI & Cloud Architecture',
    eventType: 'Workshop',
    date: todayStr,
    fromDate: todayStr,
    toDate: todayStr,
    isMultiDay: false,
    slot: 'FN',
    startTime: '09:30 AM',
    endTime: '12:30 PM',
    expectedAudience: 180,
    chiefGuest: 'Mr. B. Satyanarayana, Principal Architect, TCS',
    status: 'APPROVED',
    coordinator: mockUsers[0]._id,
    coordinatorRemarks: 'Confirmed and scheduled. Technical lab assistants assigned.',
    passNumber: 'NEC/SH-PASS/2026/1001',
    passSentToHod: true,
    passViewedByHod: false,
    coordinatorSignature: 'Dr S N Tirumala Rao (Coordinator)'
  }
];

let mockExaminerRequests = [];
let mockStationaryRequests = [];

function findMockUserByEmail(email) {
  if (!email) return null;
  return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

function findMockUserById(id) {
  if (!id) return null;
  const idStr = id.toString();
  return mockUsers.find(u => u._id === idStr) || null;
}

module.exports = {
  mockHalls,
  mockUsers,
  mockBookings,
  mockExaminerRequests,
  mockStationaryRequests,
  findMockUserByEmail,
  findMockUserById
};
