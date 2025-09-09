// routes/public.js
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

const { Event, Celebration, Member } = require('../models');
const logger = require('../utils/logger');

// @route   GET /api/public/events/upcoming
// @desc    Get upcoming events for public website
// @access  Public
router.get('/events/upcoming', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const upcomingEvents = await Event.findAll({
      where: {
        date: { [Op.gte]: new Date() },
        status: 'upcoming'
      },
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: parseInt(limit),
      attributes: [
        'id', 
        'title', 
        'description', 
        'date', 
        'time', 
        'endTime', 
        'location', 
        'category', 
        'image',
        'maxAttendees',
        'currentAttendees'
      ]
    });

    res.json({
      success: true,
      message: 'Upcoming events retrieved successfully',
      data: upcomingEvents
    });

  } catch (error) {
    logger.error('Get public upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve upcoming events'
    });
  }
});

// @route   GET /api/public/events/:id
// @desc    Get public event details
// @access  Public
router.get('/events/:id', async (req, res) => {
  try {
    const event = await Event.findOne({
      where: {
        id: req.params.id,
        status: 'upcoming',
        date: { [Op.gte]: new Date() }
      },
      attributes: [
        'id', 
        'title', 
        'description', 
        'date', 
        'time', 
        'endTime', 
        'location', 
        'category', 
        'image',
        'maxAttendees',
        'currentAttendees',
        'registrationRequired',
        'registrationDeadline',
        'eventFee'
      ]
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not available'
      });
    }

    res.json({
      success: true,
      message: 'Event details retrieved successfully',
      data: event
    });

  } catch (error) {
    logger.error('Get public event details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve event details'
    });
  }
});

// @route   GET /api/public/celebrations/upcoming
// @desc    Get upcoming approved celebrations for announcements
// @access  Public
router.get('/celebrations/upcoming', async (req, res) => {
  try {
    const { limit = 5, days = 7 } = req.query;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const upcomingCelebrations = await Celebration.findAll({
      where: {
        status: 'approved',
        isPublic: true,
        celebrationDate: {
          [Op.between]: [new Date(), futureDate]
        }
      },
      order: [['celebrationDate', 'ASC']],
      limit: parseInt(limit),
      attributes: [
        'id',
        'type',
        'name',
        'month',
        'date',
        'celebrationDate',
        'message'
      ]
    });

    res.json({
      success: true,
      message: 'Upcoming celebrations retrieved successfully',
      data: upcomingCelebrations
    });

  } catch (error) {
    logger.error('Get public upcoming celebrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve upcoming celebrations'
    });
  }
});

// @route   GET /api/public/stats
// @desc    Get basic public statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const [totalMembers, upcomingEvents, totalEvents] = await Promise.all([
      Member.count({ where: { isActive: true } }),
      Event.count({
        where: {
          date: { [Op.gte]: new Date() },
          status: 'upcoming'
        }
      }),
      Event.count()
    ]);

    res.json({
      success: true,
      data: {
        totalMembers,
        upcomingEvents,
        totalEvents,
        established: '1990' // Church establishment year
      }
    });

  } catch (error) {
    logger.error('Get public stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;