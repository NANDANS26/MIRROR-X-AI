interface Props {
  name: string;

  preview: string;
}

export default function FileMessage({
  name,
  preview,
}: Props) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#111827]">
      <img
        src={preview}
        alt={name}
        className="max-h-[350px] w-full object-contain"
      />

      <div className="px-4 py-3 text-sm text-gray-300">
        {name}
      </div>
    </div>
  );
}