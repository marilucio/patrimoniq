"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function InputField(
  props: {
    label: string;
    hint?: string;
  } & InputHTMLAttributes<HTMLInputElement>
) {
  const { label, hint, ...inputProps } = props;

  return (
    <label className="input-field">
      <div className="input-label-row">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <input {...inputProps} />
    </label>
  );
}

export function SelectField(
  props: {
    label: string;
    hint?: string;
    placeholder?: string;
    options: Array<{ label: string; value: string }>;
  } & SelectHTMLAttributes<HTMLSelectElement>
) {
  const { label, hint, placeholder, options, ...selectProps } = props;

  return (
    <label className="input-field">
      <div className="input-label-row">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <select {...selectProps}>
        <option value="">{placeholder ?? "Selecione"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField(
  props: {
    label: string;
    hint?: string;
  } & TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const { label, hint, ...textAreaProps } = props;

  return (
    <label className="input-field">
      <div className="input-label-row">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <textarea {...textAreaProps} />
    </label>
  );
}

export function FeedbackBanner(props: {
  tone: "success" | "error" | "info";
  message: string;
}) {
  return (
    <div className={`feedback-banner ${props.tone}`} role="status">
      {props.message}
    </div>
  );
}

export function FormActions(props: {
  pending?: boolean;
  submitLabel: string;
  cancelLabel?: string;
  onCancel?: () => void;
  destructiveLabel?: string;
  onDestructive?: () => void;
}) {
  return (
    <div className="form-actions">
      <button type="submit" disabled={props.pending}>
        {props.pending ? "Salvando..." : props.submitLabel}
      </button>
      {props.cancelLabel && props.onCancel ? (
        <button
          type="button"
          className="ghost-button"
          onClick={props.onCancel}
          disabled={props.pending}
        >
          {props.cancelLabel}
        </button>
      ) : null}
      {props.destructiveLabel && props.onDestructive ? (
        <button
          type="button"
          className="danger-button"
          onClick={props.onDestructive}
          disabled={props.pending}
        >
          {props.destructiveLabel}
        </button>
      ) : null}
    </div>
  );
}
