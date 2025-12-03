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
- npm 
- Docker.desktop

## Quick Start

1. Clone or download the project
2. Run setup script: `setup.bat` 
3. Start all services: `start-all.bat`
4. Build all containers: `docker-compose build`
5. Start all services: `docker-compose up -d`

## Default Test Accounts

- **Student:** username: `Gabriele`, password: `passw12345`
- **Faculty:** username: `Jonathan`, password: `pass12345`
- **Admin:** username: `Admin`, password: `pass12345`