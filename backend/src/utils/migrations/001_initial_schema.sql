-- PostgreSQL Migration: 001_initial_schema.sql
-- Task Management System Database Schema

-- =====================================================
-- DEPARTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index on department name for faster lookups
CREATE INDEX idx_departments_name ON departments(name);

-- =====================================================
-- ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name) VALUES 
    ('super_admin'), 
    ('admin'), 
    ('user')
ON CONFLICT (name) DO NOTHING;

-- Index on role name
CREATE INDEX idx_roles_name ON roles(name);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_department 
        FOREIGN KEY (department_id) 
        REFERENCES departments(id) 
        ON DELETE SET NULL
);

-- Index on department_id for faster queries
CREATE INDEX idx_users_department_id ON users(department_id);

-- Index on email for authentication lookups
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- USER_ROLES JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_role 
        FOREIGN KEY (role_id) 
        REFERENCES roles(id) 
        ON DELETE CASCADE
);

-- Index on user_id for role lookups
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Index on role_id for user lookups by role
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- =====================================================
-- TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    due_date DATE,
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    department_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_assigned_to 
        FOREIGN KEY (assigned_to) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_task_department 
        FOREIGN KEY (department_id) 
        REFERENCES departments(id) 
        ON DELETE SET NULL
);

-- Index on created_by for task listing by creator
CREATE INDEX idx_tasks_created_by ON tasks(created_by);

-- Index on assigned_to for task listing by assignee
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- Index on department_id for department-specific tasks
CREATE INDEX idx_tasks_department_id ON tasks(department_id);

-- Index on status for filtering
CREATE INDEX idx_tasks_status ON tasks(status);

-- Index on priority for filtering
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- Index on due_date for overdue task queries
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- =====================================================
-- TICKETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_from_user 
        FOREIGN KEY (from_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_to_user 
        FOREIGN KEY (to_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Index on from_user_id for ticket listing
CREATE INDEX idx_tickets_from_user_id ON tickets(from_user_id);

-- Index on to_user_id for ticket assignment
CREATE INDEX idx_tickets_to_user_id ON tickets(to_user_id);

-- Index on status for filtering
CREATE INDEX idx_tickets_status ON tickets(status);

-- =====================================================
-- UPDATE TIMESTAMP TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FOR TASKS UPDATED_AT
-- =====================================================
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();