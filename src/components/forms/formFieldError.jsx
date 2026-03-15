export default function FormFieldError({ message }) {
  if (!message) {
    return null;
  }

  return <p className="fieldError">{message}</p>;
}
