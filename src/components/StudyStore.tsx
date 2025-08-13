import { useState } from "react";
import { Search, ShoppingCart, Star, Filter, Book, Highlighter, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const StudyStore = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState(0);

  const categories = [
    { id: "textbooks", name: "Textbooks", icon: Book, color: "text-primary" },
    { id: "stationery", name: "Stationery", icon: Highlighter, color: "text-secondary" },
    { id: "papers", name: "Past Papers", icon: FileText, color: "text-accent" },
    { id: "bundles", name: "Study Bundles", icon: Package, color: "text-emerald-600" }
  ];

  const products = {
    textbooks: [
      {
        id: 1,
        name: "Grade 12 Mathematics Textbook",
        price: "R450",
        originalPrice: "R520",
        rating: 4.8,
        reviews: 124,
        image: "/placeholder.svg",
        inStock: true,
        category: "Mathematics"
      },
      {
        id: 2,
        name: "Physical Sciences Grade 11",
        price: "R380",
        rating: 4.6,
        reviews: 89,
        image: "/placeholder.svg",
        inStock: true,
        category: "Science"
      },
      {
        id: 3,
        name: "Life Sciences Grade 12",
        price: "R420",
        originalPrice: "R480",
        rating: 4.7,
        reviews: 156,
        image: "/placeholder.svg",
        inStock: false,
        category: "Science"
      }
    ],
    stationery: [
      {
        id: 4,
        name: "Highlighter Set (4 Colors)",
        price: "R45",
        rating: 4.9,
        reviews: 234,
        image: "/placeholder.svg",
        inStock: true,
        category: "Stationery"
      },
      {
        id: 5,
        name: "Scientific Calculator",
        price: "R280",
        rating: 4.8,
        reviews: 187,
        image: "/placeholder.svg",
        inStock: true,
        category: "Calculator"
      },
      {
        id: 6,
        name: "Study Notes Pack",
        price: "R85",
        rating: 4.5,
        reviews: 67,
        image: "/placeholder.svg",
        inStock: true,
        category: "Notes"
      }
    ],
    papers: [
      {
        id: 7,
        name: "Mathematics Past Papers (2019-2023)",
        price: "R120",
        rating: 4.9,
        reviews: 298,
        image: "/placeholder.svg",
        inStock: true,
        category: "Mathematics"
      },
      {
        id: 8,
        name: "Physical Sciences Past Papers",
        price: "R140",
        rating: 4.7,
        reviews: 176,
        image: "/placeholder.svg",
        inStock: true,
        category: "Science"
      }
    ],
    bundles: [
      {
        id: 9,
        name: "Grade 12 Complete Study Bundle",
        price: "R850",
        originalPrice: "R1200",
        rating: 4.9,
        reviews: 145,
        image: "/placeholder.svg",
        inStock: true,
        category: "Complete Bundle",
        badge: "Best Value"
      }
    ]
  };

  const addToCart = (productId: number, productName: string) => {
    setCartItems(cartItems + 1);
    // Using a simple toast here since StudyStore doesn't have access to the main toast
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          title: "Added to Cart!", 
          description: `${productName} has been added to your cart` 
        } 
      }));
    }
  };

  const handleFilter = () => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          title: "Filter Options", 
          description: "Advanced filtering coming soon!" 
        } 
      }));
    }
  };

  const handleCartClick = () => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          title: "Shopping Cart", 
          description: cartItems > 0 ? `You have ${cartItems} item${cartItems > 1 ? 's' : ''} in your cart` : "Your cart is empty" 
        } 
      }));
    }
  };

  const ProductCard = ({ product }: { product: any }) => (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
          <Book className="h-12 w-12 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm leading-tight">{product.name}</h4>
            {product.badge && (
              <Badge variant="destructive" className="text-xs">{product.badge}</Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">{product.category}</p>
          
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviews})</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">{product.price}</span>
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">{product.originalPrice}</span>
            )}
          </div>
          
          <Button 
            className="w-full" 
            size="sm"
            disabled={!product.inStock}
            onClick={() => addToCart(product.id, product.name)}
          >
            {product.inStock ? "Add to Cart" : "Out of Stock"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Search and Cart Header */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search textbooks, supplies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative"
          onClick={handleCartClick}
        >
          <ShoppingCart className="h-4 w-4" />
          {cartItems > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0">
              {cartItems}
            </Badge>
          )}
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Badge variant="secondary">Grade 12</Badge>
        <Badge variant="outline">Mathematics</Badge>
        <Badge variant="outline">Science</Badge>
        <Badge variant="outline">On Sale</Badge>
        <Badge variant="outline">Free Delivery</Badge>
      </div>

      {/* Categories */}
      <Tabs defaultValue="textbooks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="text-xs">
              <category.icon className={`h-4 w-4 mr-1 ${category.color}`} />
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(products).map(([categoryId, categoryProducts]) => (
          <TabsContent key={categoryId} value={categoryId} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{categories.find(c => c.id === categoryId)?.name}</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleFilter}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Featured Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">Free Delivery</h3>
              <p className="text-sm text-muted-foreground">On orders over R200</p>
            </div>
            <Package className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyStore;