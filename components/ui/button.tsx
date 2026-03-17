import { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600 ${props.className ?? ""}`}
    />
  );
}
