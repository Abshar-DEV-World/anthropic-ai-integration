import { CardDemo } from "@/components/demo/CardDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto">
        <div className="py-8">
          <h1 className="text-3xl font-bold mb-2">Card Component Demo</h1>
          <p className="text-neutral-600 mb-8">
            Examples of the Card component with different configurations
          </p>
        </div>
        <CardDemo />
      </div>
    </div>
  );
}
