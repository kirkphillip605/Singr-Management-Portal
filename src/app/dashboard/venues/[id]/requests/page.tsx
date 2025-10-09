import { notFound } from "next/navigation";
import { getVenueById } from "@/lib/api/venues"; // Adjust import based on your actual API functions
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";

interface RequestsPageProps {
  params: {
    venueId: string;
  };
}

export default async function VenueRequestsPage({ params }: RequestsPageProps) {
  // Fetch the venue to verify it exists
  try {
    const venue = await getVenueById(params.venueId);
    
    if (!venue) {
      return notFound();
    }
    
    // For now, we'll return an empty requests list
    // This should eventually be replaced with actual requests data
    const requests: any[] = [];

    return (
      <div className="flex-col">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between">
            <Heading
              title={`Requests for ${venue.name}`}
              description="View and manage song requests for this venue"
            />
          </div>
          <Separator />
          
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-lg">No requests found for this venue.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              {/* Request list would go here */}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading venue requests:", error);
    return notFound();
  }
}
