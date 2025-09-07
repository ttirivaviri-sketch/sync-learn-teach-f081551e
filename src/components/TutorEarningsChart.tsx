import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface TutorEarningsChartProps {
  data: Array<{
    name: string;
    earnings: number;
    sessions: number;
  }>;
  type?: "line" | "bar";
}

const TutorEarningsChart = ({ data, type = "line" }: TutorEarningsChartProps) => {
  const ChartComponent = type === "line" ? LineChart : BarChart;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                name === "earnings" ? `R${value}` : value,
                name === "earnings" ? "Earnings" : "Sessions"
              ]}
            />
            {type === "line" ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="sessions" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                />
              </>
            ) : (
              <>
                <Bar dataKey="earnings" fill="hsl(var(--primary))" />
                <Bar dataKey="sessions" fill="hsl(var(--secondary))" />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TutorEarningsChart;