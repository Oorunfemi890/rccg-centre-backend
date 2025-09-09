// services/cronJobs.js
const cron = require('node-cron');
const { Celebration, Member, Event } = require('../models');
const { Op } = require('sequelize');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class CronJobService {
  constructor() {
    this.initializeJobs();
  }

  initializeJobs() {
    // Send birthday wishes daily at 6:00 AM
    cron.schedule('0 6 * * *', () => {
      this.sendBirthdayWishes();
    }, {
      timezone: 'Africa/Lagos'
    });

    // Send event reminders daily at 8:00 AM
    cron.schedule('0 8 * * *', () => {
      this.sendEventReminders();
    }, {
      timezone: 'Africa/Lagos'
    });

    // Clean up expired tokens daily at midnight
    cron.schedule('0 0 * * *', () => {
      this.cleanupExpiredTokens();
    }, {
      timezone: 'Africa/Lagos'
    });

    // Update event statuses every hour
    cron.schedule('0 * * * *', () => {
      this.updateEventStatuses();
    });

    logger.info('Cron jobs initialized successfully');
  }

  async sendBirthdayWishes() {
    try {
      logger.info('Running birthday wishes cron job...');
      
      const today = new Date();
      const month = today.getMonth() + 1;
      const date = today.getDate();

      // Get today's celebrations
      const todaysCelebrations = await Celebration.getTodaysCelebrations();

      for (const celebration of todaysCelebrations) {
        if (!celebration.notificationSent) {
          try {
            await emailService.sendBirthdayEmail(celebration);
            await celebration.update({ notificationSent: true });
            logger.info(`Birthday email sent to ${celebration.name}`);
          } catch (error) {
            logger.error(`Failed to send birthday email to ${celebration.name}:`, error);
          }
        }
      }

      logger.info(`Birthday wishes cron job completed. Processed ${todaysCelebrations.length} celebrations`);
    } catch (error) {
      logger.error('Birthday wishes cron job failed:', error);
    }
  }

  async sendEventReminders() {
    try {
      logger.info('Running event reminders cron job...');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateString = tomorrow.toISOString().split('T')[0];

      // Get events happening tomorrow
      const tomorrowEvents = await Event.findAll({
        where: {
          date: tomorrowDateString,
          status: 'upcoming'
        }
      });

      // Get all active members
      const activeMembers = await Member.findActiveMembers();

      for (const event of tomorrowEvents) {
        for (const member of activeMembers) {
          try {
            await emailService.sendEventReminderEmail(event, member);
            logger.info(`Event reminder sent to ${member.name} for ${event.title}`);
          } catch (error) {
            logger.error(`Failed to send event reminder to ${member.name}:`, error);
          }
        }
      }

      logger.info(`Event reminders cron job completed. Processed ${tomorrowEvents.length} events for ${activeMembers.length} members`);
    } catch (error) {
      logger.error('Event reminders cron job failed:', error);
    }
  }

  async cleanupExpiredTokens() {
    try {
      logger.info('Running cleanup expired tokens cron job...');
      
      const { Admin } = require('../models');
      
      // Clear expired password reset tokens
      const expiredTokensCount = await Admin.update(
        {
          passwordResetToken: null,
          passwordResetExpires: null
        },
        {
          where: {
            passwordResetExpires: {
              [Op.lt]: new Date()
            }
          }
        }
      );

      logger.info(`Cleanup completed. Removed ${expiredTokensCount[0]} expired tokens`);
    } catch (error) {
      logger.error('Cleanup expired tokens cron job failed:', error);
    }
  }

  async updateEventStatuses() {
    try {
      logger.info('Running update event statuses cron job...');
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Mark past events as completed if they're still marked as upcoming
      const updatedEventsCount = await Event.update(
        { status: 'completed' },
        {
          where: {
            date: {
              [Op.lt]: today
            },
            status: 'upcoming'
          }
        }
      );

      logger.info(`Updated ${updatedEventsCount[0]} past events to completed status`);
    } catch (error) {
      logger.error('Update event statuses cron job failed:', error);
    }
  }

  // Method to manually trigger birthday wishes (for testing)
  async triggerBirthdayWishes() {
    await this.sendBirthdayWishes();
  }

  // Method to manually trigger event reminders (for testing)
  async triggerEventReminders() {
    await this.sendEventReminders();
  }
}

module.exports = new CronJobService();