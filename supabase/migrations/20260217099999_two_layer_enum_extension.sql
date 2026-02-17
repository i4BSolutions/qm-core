-- Migration: 20260217099999_two_layer_enum_extension.sql
-- Description: Extend sor_line_item_status enum with two-layer approval values.
--              Must run in a separate transaction BEFORE the main two-layer schema migration
--              because PostgreSQL prohibits using newly added enum values in the same transaction.
-- Phase: 55-database-foundation-useravatar
-- Plan: 55-01

ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin';
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'fully_approved';
