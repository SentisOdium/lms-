import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { readJson, updateJson } from '../storage/jsonStore.js';

/**
 * Register a new instructor
 */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const instructors = await readJson(config.instructorsFile, []);

    const existing = instructors.find(i => i.email.toLowerCase() === trimmedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An instructor account with this email already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const instructor_id = `INST-${Date.now().toString().slice(-6)}`;
    const newInstructor = {
      instructor_id,
      name: name.trim(),
      email: trimmedEmail,
      password_hash,
      created_at: new Date().toISOString()
    };

    await updateJson(config.instructorsFile, (list) => {
      list.push(newInstructor);
      return list;
    });

    const token = jwt.sign(
      { instructor_id: newInstructor.instructor_id, email: newInstructor.email, name: newInstructor.name },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Instructor registered successfully.',
      token,
      instructor: {
        instructor_id: newInstructor.instructor_id,
        name: newInstructor.name,
        email: newInstructor.email
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log in existing instructor
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const instructors = await readJson(config.instructorsFile, []);

    const instructor = instructors.find(i => i.email.toLowerCase() === trimmedEmail);
    if (!instructor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, instructor.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      { instructor_id: instructor.instructor_id, email: instructor.email, name: instructor.name },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      instructor: {
        instructor_id: instructor.instructor_id,
        name: instructor.name,
        email: instructor.email
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current authenticated instructor profile
 */
export async function getMe(req, res, next) {
  try {
    const instructors = await readJson(config.instructorsFile, []);
    const instructor = instructors.find(i => i.instructor_id === req.instructor.instructor_id);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor profile not found.'
      });
    }

    res.json({
      success: true,
      instructor: {
        instructor_id: instructor.instructor_id,
        name: instructor.name,
        email: instructor.email,
        created_at: instructor.created_at
      }
    });
  } catch (err) {
    next(err);
  }
}

