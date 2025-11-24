# Distributed Online Enrollment System

A fault-tolerant, distributed web application built with Node.js and Express, implementing a microservices architecture.

## Features

- JWT-based authentication
- Session management across distributed nodes
- Course catalog and enrollment
- Grade management system
- Role-based access control (Student/Faculty/Admin)
- Fault-tolerant architecture

## Architecture

- **Node 1 (Port 3000):** Frontend/View Layer
- **Node 2 (Port 3001):** Authentication Service
- **Node 3 (Port 3002):** Course Management Service
- **Node 4 (Port 3003):** Grade Management Service

## Prerequisites

- Node.js v14+
- npm or yarn
- 4 VMs or separate machines (or use localhost for testing)

## Quick Start

1. Clone or download the project
2. Run setup script: `setup.bat` (Windows)
3. Start all services: `start-all.bat`
4. Access the application at `http://localhost:3000`

## Default Test Accounts

- **Student:** username: `student1`, password: `password123`
- **Faculty:** username: `faculty1`, password: `password123`
- **Admin:** username: `admin1`, password: `password123`