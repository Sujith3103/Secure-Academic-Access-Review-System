import { PrismaClient, UserRole, AuditAction, SubmissionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ── Admin User ────────────────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('Admin@2024!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@saars.io' },
        update: {},
        create: {
            email: 'admin@saars.io',
            password: adminPassword,
            firstName: 'System',
            lastName: 'Admin',
            role: UserRole.ADMIN,
        },
    });
    console.log('✅ Admin created:', admin.email);

    // ── Staff Users ───────────────────────────────────────────────────────
    const staffPassword = await bcrypt.hash('Staff@2024!', 12);
    const staff1 = await prisma.user.upsert({
        where: { email: 'dr.smith@saars.io' },
        update: {},
        create: {
            email: 'dr.smith@saars.io',
            password: staffPassword,
            firstName: 'Dr. John',
            lastName: 'Smith',
            role: UserRole.STAFF,
        },
    });

    const staff2 = await prisma.user.upsert({
        where: { email: 'ms.priya@saars.io' },
        update: {},
        create: {
            email: 'ms.priya@saars.io',
            password: staffPassword,
            firstName: 'Ms. Priya',
            lastName: 'Nair',
            role: UserRole.STAFF,
        },
    });
    console.log('✅ Staff created:', staff1.email, staff2.email);

    // ── Student Users ─────────────────────────────────────────────────────
    const studentPassword = await bcrypt.hash('Student@2024!', 12);
    const students = [];
    for (let i = 1; i <= 5; i++) {
        const student = await prisma.user.upsert({
            where: { email: `student${i}@saars.io` },
            update: {},
            create: {
                email: `student${i}@saars.io`,
                password: studentPassword,
                firstName: `Student`,
                lastName: `${i}`,
                role: UserRole.STUDENT,
            },
        });
        students.push(student);
    }
    console.log('✅ Students created:', students.length);

    // ── Academic Cycle ────────────────────────────────────────────────────
    const cycle = await prisma.academicCycle.upsert({
        where: { id: 'seed-cycle-2024' },
        update: {},
        create: {
            id: 'seed-cycle-2024',
            name: 'Academic Year 2024-25 (Semester 1)',
            description: 'First semester of 2024-25 academic year',
            startDate: new Date('2024-07-01'),
            endDate: new Date('2024-12-31'),
            isActive: true,
        },
    });
    console.log('✅ Academic cycle created:', cycle.name);

    // ── Staff-Student Mappings ─────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
        await prisma.staffStudentMapping.upsert({
            where: { staffId_studentId: { staffId: staff1.id, studentId: students[i].id } },
            update: {},
            create: { staffId: staff1.id, studentId: students[i].id },
        });
    }
    for (let i = 3; i < 5; i++) {
        await prisma.staffStudentMapping.upsert({
            where: { staffId_studentId: { staffId: staff2.id, studentId: students[i].id } },
            update: {},
            create: { staffId: staff2.id, studentId: students[i].id },
        });
    }
    console.log('✅ Staff-student mappings created');

    // ── Sample Assignments ────────────────────────────────────────────────
    const assignment1 = await prisma.assignment.create({
        data: {
            title: 'Research Paper on Machine Learning Ethics',
            description: 'Write a 2000-word research paper on ethical considerations in modern ML systems.',
            dueDate: new Date('2024-11-30'),
            maxGrade: 100,
            academicCycleId: cycle.id,
            staffId: staff1.id,
        },
    });

    const assignment2 = await prisma.assignment.create({
        data: {
            title: 'Database Design Project',
            description: 'Design a normalized relational database schema for an e-commerce system.',
            dueDate: new Date('2024-12-15'),
            maxGrade: 50,
            academicCycleId: cycle.id,
            staffId: staff1.id,
        },
    });
    console.log('✅ Assignments created:', assignment1.title, assignment2.title);

    // ── Sample Submission ─────────────────────────────────────────────────
    const submission = await prisma.submission.create({
        data: {
            assignmentId: assignment1.id,
            studentId: students[0].id,
            content: 'Machine learning ethics involves ensuring fairness, transparency, and accountability...',
            status: SubmissionStatus.SUBMITTED,
        },
    });
    console.log('✅ Sample submission created');

    // ── Audit log ─────────────────────────────────────────────────────────
    await prisma.auditLog.create({
        data: {
            actorId: admin.id,
            action: AuditAction.CREATE,
            resource: 'seed',
            meta: { message: 'Database seeded successfully' },
        },
    });

    console.log('\n🎉 Seeding complete!');
    console.log('\n📋 Login credentials:');
    console.log('  Admin:   admin@saars.io     / Admin@2024!');
    console.log('  Staff 1: dr.smith@saars.io  / Staff@2024!');
    console.log('  Staff 2: ms.priya@saars.io  / Staff@2024!');
    console.log('  Student: student1@saars.io  / Student@2024!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
