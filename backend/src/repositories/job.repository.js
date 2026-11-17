import { prisma } from '../config/prisma.js';

export class JobRepository {
  /**
   * Atomically claims the next eligible job (PENDING or stale PROCESSING).
   */
  async claimNextJob(staleLockMs = 300000) {
    const staleCutoff = new Date(Date.now() - staleLockMs);

    return prisma.$transaction(async (tx) => {
      // Find one candidate job: either PENDING or a stale PROCESSING job whose lock expired
      const candidate = await tx.ingestionJob.findFirst({
        where: {
          OR: [
            { status: 'PENDING' },
            {
              status: 'PROCESSING',
              lockedAt: { lte: staleCutoff },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        include: { item: true },
      });

      if (!candidate) {
        return null;
      }

      // Atomically claim the job
      const claimedJob = await tx.ingestionJob.update({
        where: { id: candidate.id },
        data: {
          status: 'PROCESSING',
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
        include: { item: true },
      });

      // Synchronize item status to PROCESSING
      await tx.item.update({
        where: { id: candidate.itemId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      return claimedJob;
    });
  }

  /**
   * Marks a job as COMPLETED and clears its lock.
   */
  async completeJob(jobId) {
    return prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        lockedAt: null,
      },
    });
  }

  /**
   * Updates job after a failure. If attempts remain, resets to PENDING; otherwise marks FAILED.
   */
  async failJob(jobId, errorMessage, willRetry) {
    return prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: willRetry ? 'PENDING' : 'FAILED',
        lockedAt: null,
        lastError: errorMessage,
      },
    });
  }

  async findById(id) {
    return prisma.ingestionJob.findUnique({
      where: { id },
      include: { item: true },
    });
  }
}

export const jobRepository = new JobRepository();
