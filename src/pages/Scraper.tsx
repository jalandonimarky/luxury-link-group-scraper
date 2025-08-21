import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Search, Loader2 } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Product {
  "Product Name": string;
  "Price": string;
  "Link": string;
  "Seller": string;
  "Image URL": string;
}

const Scraper = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');

  const sellers = [
    { name: "質ウエダ ★", url: "uedasakae", star: true },
    { name: "リマルク 楽天市場店 ★", url: "2017style", star: true },
    { name: "高山質店 ★", url: "takayama78", star: true },
    { name: "【銀座パリス】 楽天市場店 ★", url: "auc-ginzaparis", star: true },
    { name: "ブランドラコル ★", url: "aquayuta", star: true },
    { name: "VINTAGE LOVER PURPOSE ★", url: "purpose-inc", star: true },
    { name: "ALLU 楽天市場店 ★", url: "allu-r", star: true },
    { name: "Blumin 楽天市場店 ★", url: "blumin-2", star: true },
    { name: "HOUBIDOU 心斎橋店 ★", url: "mycollection", star: true },
    { name: "ブランドショップ リファレンス ★", url: "reference", star: true },
    { name: "JJcollection ★", url: "jjcollection", star: true },
    { name: "その他", url: "", star: false }, // Separator
    { name: "ブランディア 楽天市場店", url: "brandear-store", star: false },
    { name: "かんてい局名古屋錦三丁目・緑店", url: "kanteikyoku-nishikisan", star: false },
    { name: "平山質店楽天市場店", url: "hirayama7ten", star: false },
    { name: "MODESCAPE 楽天市場店", url: "modescape", star: false },
    { name: "万代Net店", url: "mandai", star: false },
    { name: "質Shop 天満屋", url: "auc-tenmaya78", star: false },
    { name: "p.o.s.h. Online Store 楽天市場店", url: "auc-posh", star: false },
    { name: "質屋かんてい局 楽天市場店", url: "kanteikyoku", star: false }
  ];

  const starredSellers = sellers.filter(s => s.star);
  const otherSellers = sellers.filter(s => !s.star && s.url);

  const handleSearch = async (searchType: 'product' | 'sellerDropdown' | 'sellerSearch') => {
    setIsLoading(true);
    const loadingToast = showLoading('Scraping products...');

    try {
      const payload: any = {};
      
      if (searchType === 'product') {
        payload.search = searchTerm;
      } else if (searchType === 'sellerDropdown') {
        payload.seller = sellerFilter;
      } else if (searchType === 'sellerSearch') {
        payload.sellerSearch = sellerSearch;
      }

      const response = await fetch('http://127.0.0.1:5000/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.data || []);
        setSearchUrl(data.search_url || '');
        dismissToast(loadingToast);
        showSuccess(`Found ${data.data?.length || 0} products!`);
      } else {
        dismissToast(loadingToast);
        showError(data.error || 'Failed to scrape products');
      }
    } catch (error) {
      dismissToast(loadingToast);
      showError('Failed to connect to scraper. Make sure your Python server is running.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Rakuten Product Scraper</h1>
        <p className="text-muted-foreground">
          Search for products or sellers on Rakuten through FromJapan
        </p>
      </div>

      <Tabs defaultValue="product" className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="product">Product Search</TabsTrigger>
          <TabsTrigger value="sellerDropdown">Seller Filter</TabsTrigger>
          <TabsTrigger value="sellerSearch">Seller Search</TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Products</CardTitle>
              <CardDescription>
                Enter a product name to search for on Rakuten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="product-search">Product Name</Label>
                <Input
                  id="product-search"
                  placeholder="e.g., iPhone, Nintendo Switch, etc."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch('product')}
                />
              </div>
              <Button 
                onClick={() => handleSearch('product')} 
                disabled={!searchTerm.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Search Products
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sellerDropdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter by Seller</CardTitle>
              <CardDescription>
                Select a seller from the list or enter a custom ID (minimum price: ¥50,000)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Seller</Label>
                <Select onValueChange={setSellerFilter} value={sellerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a seller from the list" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Starred Sellers</SelectLabel>
                      {starredSellers.map((seller) => (
                        <SelectItem key={seller.url} value={seller.url}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Other Sellers</SelectLabel>
                      {otherSellers.map((seller) => (
                        <SelectItem key={seller.url} value={seller.url}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="seller-filter">Or Enter Custom Seller ID</Label>
                <Input
                  id="seller-filter"
                  placeholder="e.g., custom-seller-id"
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch('sellerDropdown')}
                />
              </div>
              <Button 
                onClick={() => handleSearch('sellerDropdown')} 
                disabled={!sellerFilter.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Filter by Seller
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sellerSearch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search by Seller Name</CardTitle>
              <CardDescription>
                Enter a seller name to search for their products (minimum price: ¥50,000)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seller-search">Seller Name</Label>
                <Input
                  id="seller-search"
                  placeholder="e.g., Electronics Store"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch('sellerSearch')}
                />
              </div>
              <Button 
                onClick={() => handleSearch('sellerSearch')} 
                disabled={!sellerSearch.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Search by Seller
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {searchUrl && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Search URL:</strong>{' '}
              <a 
                href={searchUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {searchUrl}
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">
            Results ({results.length} products found)
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map((product, index) => (
              <Card key={index} className="overflow-hidden">
                <div className="aspect-square relative bg-gray-100">
                  {product["Image URL"] && product["Image URL"] !== "No image URL" ? (
                    <img
                      src={product["Image URL"]}
                      alt={product["Product Name"]}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                    {product["Product Name"]}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-lg font-bold">
                        {product["Price"]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Seller:</strong> {product["Seller"]}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(product["Link"], '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Product
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Scraper;