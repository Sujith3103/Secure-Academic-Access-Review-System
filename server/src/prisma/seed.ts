import { PrismaClient, UserRole, AuditAction, SubmissionStatus, ReEvalStatus } from '@prisma/client';
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

    const assignment3 = await prisma.assignment.create({
        data: {
            title: 'Web Security Analysis Report',
            description: 'Analyze common web security vulnerabilities (OWASP Top 10) and provide mitigation strategies.',
            dueDate: new Date('2025-01-15'),
            maxGrade: 100,
            academicCycleId: cycle.id,
            staffId: staff2.id,
        },
    });
    console.log('✅ Assignments created:', assignment1.title, assignment2.title, assignment3.title);

    // ── Sample Submissions (with versioning + late flags) ─────────────────
    const submission1 = await prisma.submission.create({
        data: {
            assignmentId: assignment1.id,
            studentId: students[0].id,
            content: 'Machine learning ethics involves ensuring fairness, transparency, and accountability...',
            status: SubmissionStatus.SUBMITTED,
            version: 1,
            isLate: false,
        },
    });

    // A second version from same student (demonstrates versioning)
    const submission1v2 = await prisma.submission.create({
        data: {
            assignmentId: assignment1.id,
            studentId: students[0].id,
            content: 'REVISED: Machine learning ethics involves ensuring fairness, transparency, accountability, and privacy...',
            status: SubmissionStatus.SUBMITTED,
            version: 2,
            isLate: false,
        },
    });

    // A graded submission from student 2
    const submission2 = await prisma.submission.create({
        data: {
            assignmentId: assignment1.id,
            studentId: students[1].id,
            content: 'Ethics in AI focuses on preventing bias, ensuring transparency, and maintaining human oversight...',
            status: SubmissionStatus.GRADED,
            version: 1,
            isLate: false,
        },
    });

    // A late submission from student 3
    await prisma.submission.create({
        data: {
            assignmentId: assignment2.id,
            studentId: students[0].id,
            content: 'E-commerce database schema with normalized tables for products, orders, customers, and payments...',
            status: SubmissionStatus.SUBMITTED,
            version: 1,
            isLate: true,
        },
    });

    console.log('✅ Sample submissions created (including versioned and late)');

    // ── Grade for submission2 ──────────────────────────────────────────────
    const grade = await prisma.grade.create({
        data: {
            submissionId: submission2.id,
            studentId: students[1].id,
            staffId: staff1.id,
            score: 85,
            feedback: 'Well-researched paper with strong arguments. Could improve on practical examples.',
        },
    });

    // ── Review comment for submission1v2 ───────────────────────────────────
    await prisma.reviewComment.create({
        data: {
            submissionId: submission1v2.id,
            comment: 'Good improvement on the revised version. Please expand the section on privacy concerns before final grading.',
            staffId: staff1.id,
        },
    });
    console.log('✅ Grades and review comments created');

    // ── Re-evaluation request (from student 2 on graded submission) ──────
    await prisma.reEvaluationRequest.create({
        data: {
            submissionId: submission2.id,
            studentId: students[1].id,
            reason: 'I believe my analysis on algorithmic bias deserves more credit. I referenced 5 peer-reviewed papers but the score does not reflect the depth of research.',
            status: ReEvalStatus.PENDING,
        },
    });
    console.log('✅ Re-evaluation request created');

    // ── Audit logs ─────────────────────────────────────────────────────────
    const auditEntries = [
        { actorId: admin.id, action: AuditAction.CREATE, resource: 'seed', status: 'SUCCESS', meta: { message: 'Database seeded successfully' } },
        { actorId: admin.id, action: AuditAction.CREATE, resource: 'users', status: 'SUCCESS', resourceId: staff1.id, meta: { email: staff1.email } },
        { actorId: admin.id, action: AuditAction.ASSIGN, resource: 'staff_student_mappings', status: 'SUCCESS', meta: { staffId: staff1.id, studentCount: 3 } },
        { actorId: staff1.id, action: AuditAction.CREATE, resource: 'assignments', status: 'SUCCESS', resourceId: assignment1.id },
        { actorId: students[0].id, action: AuditAction.SUBMIT, resource: 'submissions', status: 'SUCCESS', resourceId: submission1.id, meta: { version: 1 } },
        { actorId: students[0].id, action: AuditAction.SUBMIT, resource: 'submissions', status: 'SUCCESS', resourceId: submission1v2.id, meta: { version: 2 } },
        { actorId: staff1.id, action: AuditAction.GRADE, resource: 'grades', status: 'SUCCESS', resourceId: grade.id, meta: { score: 85 } },
        { actorId: students[1].id, action: AuditAction.CREATE, resource: 're_evaluations', status: 'SUCCESS', meta: { reason: 'Grade dispute' } },
    ];

    for (const entry of auditEntries) {
        await prisma.auditLog.create({ data: entry });
    }
    console.log('✅ Audit logs seeded:', auditEntries.length, 'entries');

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
